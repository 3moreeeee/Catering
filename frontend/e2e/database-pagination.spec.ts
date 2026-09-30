import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * The catalogue is read from the database one page (at most 12 products) at a
 * time, server-rendered, then hydrated without asking the API again.
 *
 * Every expectation is derived from the live API at test time — nothing about
 * the catalogue (its size, its order, its names) is hard-coded.
 */

interface ApiItem {
  readonly slug: string;
  readonly categoryId: string;
  readonly name: { readonly fr: string; readonly en: string | null };
}
interface ApiPage {
  readonly items: readonly ApiItem[];
  readonly total: number;
  readonly totalPages: number;
}

const LOCALES = ['fr', 'en'] as const;

async function apiPage(request: APIRequestContext, page: number): Promise<ApiPage> {
  const response = await request.get(`/api/products?page=${page - 1}&pageSize=12`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiPage;
}

const nameOf = (item: ApiItem, lang: string): string =>
  lang === 'en' ? item.name.en || item.name.fr : item.name.fr;
const squash = (value: string): string => value.replace(/[\s\u00a0\u202f]+/g, ' ').trim();

async function cardSlugs(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator('.catalog__results .card__link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  return hrefs.map((href) => href.split('?')[0]!.split('/').pop()!);
}

test.describe('database-backed catalogue pagination', () => {
  test('the API never returns more than 12 products, whatever is asked', async ({ request }) => {
    for (const size of ['', '&pageSize=12', '&pageSize=100', '&pageSize=1000']) {
      const response = await request.get(`/api/products?page=0${size}`);
      const body = (await response.json()) as ApiPage & { pageSize: number };
      expect(body.items.length).toBeLessThanOrEqual(12);
      expect(body.pageSize).toBe(12);
    }
  });

  for (const lang of LOCALES) {
    test(`${lang}: pages 1, 2, 3 and the last show the database page`, async ({
      page,
      request,
    }) => {
      const first = await apiPage(request, 1);
      const last = first.totalPages;
      const seen: string[][] = [];
      for (const number of [...new Set([1, 2, 3, last])]) {
        const expected = await apiPage(request, number);
        await page.goto(`/${lang}/products${number > 1 ? `?page=${number}` : ''}`);
        const cards = page.locator('.catalog__results .card__name');
        await expect(cards).toHaveCount(expected.items.length);
        expect(expected.items.length).toBeLessThanOrEqual(12);
        const names = (await cards.allInnerTexts()).map(squash);
        expect(names).toEqual(expected.items.map((item) => squash(nameOf(item, lang))));
        const slugs = await cardSlugs(page);
        expect(slugs).toEqual(expected.items.map((item) => item.slug));
        seen.push(slugs);

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical).toBe(
          `https://www.catering.com.tn/${lang}/products${number > 1 ? `?page=${number}` : ''}`,
        );

        const hrefs = await page
          .locator('.catalog__pagination a')
          .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
        expect(hrefs.length).toBeGreaterThan(0);
        for (const href of hrefs)
          expect(href).toMatch(new RegExp(`^/${lang}/products(\\?page=\\d+)?$`));
      }
      // Adjacent pages never repeat a product.
      for (let index = 1; index < seen.length; index++) {
        expect(seen[index]!.filter((slug) => seen[index - 1]!.includes(slug))).toEqual([]);
      }
    });
  }

  test('refresh keeps the page, and back/forward walk the history', async ({ page, request }) => {
    const [one, two] = [await apiPage(request, 1), await apiPage(request, 2)];
    await page.goto('/fr/products');
    await expect(page.locator('.catalog__results .card__link').first()).toHaveAttribute(
      'href',
      new RegExp(`/${one.items[0]!.slug}$`),
    );

    await page.locator('.catalog__pagination a[rel="next"]').click();
    await expect(page).toHaveURL(/\/fr\/products\?page=2$/);
    await expect.poll(() => cardSlugs(page)).toEqual(two.items.map((item) => item.slug));

    await page.reload();
    await expect(page).toHaveURL(/\/fr\/products\?page=2$/);
    expect(await cardSlugs(page)).toEqual(two.items.map((item) => item.slug));
    // Let the reloaded application finish booting before stepping through
    // history, as a person would; a history step during bootstrap races the
    // router's initial navigation, which is not what this test is about.
    await page.waitForLoadState('networkidle');

    await page.goBack();
    await expect(page).toHaveURL(/\/fr\/products$/);
    await expect.poll(() => cardSlugs(page)).toEqual(one.items.map((item) => item.slug));

    await page.goForward();
    await expect(page).toHaveURL(/\/fr\/products\?page=2$/);
    await expect.poll(() => cardSlugs(page)).toEqual(two.items.map((item) => item.slug));
  });

  test('a product link opens that product, looked up directly', async ({ page, request }) => {
    const two = await apiPage(request, 2);
    const target = two.items[0]!;
    await page.goto('/fr/products?page=2');
    const lookups: string[] = [];
    page.on('request', (r) => {
      if (/\/api\/products(\?|$)/.test(r.url())) lookups.push(r.url());
    });
    await page.locator('.catalog__results .card__link').first().click();
    await expect(page).toHaveURL(new RegExp(`/fr/products/[a-z-]+/${target.slug}$`));
    await expect(page.locator('h1')).toHaveText(
      new RegExp(
        squash(nameOf(target, 'fr'))
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/ /g, '[\\s\\u00a0\\u202f]+'),
      ),
    );
    // No catalogue listing is fetched to find one product.
    expect(lookups).toEqual([]);
  });

  test('hydration reuses the server responses: no duplicate catalogue request', async ({
    page,
  }) => {
    const browserRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/products'))
        browserRequests.push(new URL(r.url()).pathname + new URL(r.url()).search);
    });
    await page.goto('/fr/products?page=2');
    await page.waitForLoadState('networkidle');
    expect(browserRequests.filter((url) => /^\/api\/products\?/.test(url))).toEqual([]);
    expect(browserRequests.filter((url) => url.startsWith('/api/products/facets'))).toEqual([]);
    expect(browserRequests.filter((url) => url.startsWith('/api/products/prices'))).toEqual([]);

    browserRequests.length = 0;
    await page.goto('/en/products/monin/monin-sirop-caramel-25cl');
    await page.waitForLoadState('networkidle');
    expect(
      browserRequests.filter((url) => url === '/api/products/monin-sirop-caramel-25cl'),
    ).toEqual([]);
    expect(browserRequests.filter((url) => url.includes('/related'))).toEqual([]);
  });

  test('product images load from ImageKit, none broken', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() === 'image' && response.status() >= 400) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });
    for (const url of ['/fr/products?page=2', '/en/products?page=3']) {
      await page.goto(url);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      });
      const images = page.locator('.catalog__results img');
      await expect(images.first()).toBeVisible();
      await expect
        .poll(() =>
          images.evaluateAll(
            (all) =>
              all.filter(
                (img) =>
                  !(img as HTMLImageElement).complete ||
                  (img as HTMLImageElement).naturalWidth === 0,
              ).length,
          ),
        )
        .toBe(0);
      const sources = await images.evaluateAll((all) =>
        all.map((img) => (img as HTMLImageElement).currentSrc),
      );
      for (const src of sources) expect(src).toMatch(/^https:\/\/ik\.imagekit\.io\//);
    }
    expect(failures).toEqual([]);
  });
});
