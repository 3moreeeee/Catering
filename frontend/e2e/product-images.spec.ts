import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, Page, test } from '@playwright/test';

/**
 * Photographs matched to new products (src/app/data/catalog-images.data.ts)
 * and the price display.
 *
 * The matched photographs live in public/img/products/catalogue/ until they
 * are uploaded to ImageKit, so their ImageKit URLs are answered from the local
 * build here. Every other image is fetched from ImageKit as usual.
 */

const CATALOGUE = path.resolve('public/img/products/catalogue');

async function serveCatalogueImages(page: Page): Promise<void> {
  await page.route('**/fk-catering/img/products/catalogue/**', (route) => {
    const file = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
    route.fulfill({ contentType: 'image/webp', body: readFileSync(path.join(CATALOGUE, file)) });
  });
}

async function cardOf(page: Page, lang: 'fr' | 'en', query: string, name: string) {
  await page.goto(`/${lang}/products?q=${encodeURIComponent(query)}`);
  const card = page.locator('fk-product-card').filter({ hasText: name });
  await expect(card).toHaveCount(1);
  return card;
}

/** The card's photograph has loaded (naturalWidth > 0), and from where. */
async function photoOf(card: ReturnType<Page['locator']>): Promise<string> {
  const image = card.locator('img').first();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  return (await image.getAttribute('src')) ?? '';
}

for (const lang of ['fr', 'en'] as const) {
  test.describe(`matched photographs (${lang})`, () => {
    test.beforeEach(({ page }) => serveCatalogueImages(page));

    test('each product shows its own flavour and format', async ({ page }) => {
      const cases = lang === 'fr'
        ? [
            ['Sirop vanille', 'Sirop vanille MONIN 25cl', 'monin-sirop-vanille-25cl'],
            ['Sirop saveur caramel', 'Sirop saveur caramel MONIN 25cl', 'monin-sirop-caramel-25cl'],
            ['Purée de mangue', 'Purée de mangue MONIN 1L', 'monin-puree-mangue-1l'],
            ['Frappé chocolat', 'Frappé chocolat MONIN 1.36kg', 'monin-frappe-chocolat-1-36kg'],
          ]
        : [
            ['vanilla syrup 25', 'MONIN vanilla syrup 25 cl', 'monin-sirop-vanille-25cl'],
            ['mango fruit purée', 'MONIN mango fruit purée 1 l', 'monin-puree-mangue-1l'],
            ['Wrapped chopsticks', 'Wrapped chopsticks 21 cm', 'baguette-chinoise-enveloppee-21cm'],
          ];
      for (const [query, name, file] of cases) {
        expect(await photoOf(await cardOf(page, lang, query, name)), name).toContain(`/img/products/catalogue/${file}.v2.webp`);
      }
    });

    test('each format carries its own photograph, and none borrows another', async ({ page }) => {
      const own = lang === 'fr'
        ? [
            ['Sirop caramel MONIN 1L', 'monin-sirop-caramel-1l'],
            ['Sirop saveur caramel MONIN 25cl', 'monin-sirop-caramel-25cl'],
            ['Frappé vanille MONIN sac 2kg', 'monin-frappe-vanille-sac-2kg'],
            ['Champignons en tranches Emporium 850g', 'champignons-en-tranches-emporium-850g'],
          ]
        : [['MONIN caramel syrup 1 l', 'monin-sirop-caramel-1l']];
      for (const [name, file] of own) {
        expect(await photoOf(await cardOf(page, lang, name, name)), name).toContain(`/img/products/catalogue/${file}.v2.webp`);
      }
      // Cookies 70 cl shows the photograph the owner uploaded, served by ImageKit.
      const name = lang === 'fr' ? 'Sirop cookies MONIN 70cl' : 'MONIN cookie syrup 70 cl';
      expect(await photoOf(await cardOf(page, lang, name, name)), name).toContain('/img/products/admin/');
    });
  });
}

test.describe('prices', () => {
  test.beforeEach(({ page }) => serveCatalogueImages(page));

  test('show the amount and currency only, unchanged, in grid and list views', async ({ page }) => {
    for (const lang of ['fr', 'en'] as const) {
      await page.goto(`/${lang}/products?q=${lang === 'fr' ? 'Bonnet de douche' : 'Shower cap'}`);
      const card = page.locator('fk-product-card').filter({ hasText: lang === 'fr' ? 'Bonnet de douche' : 'Shower cap' });
      const price = card.locator('.card__price');
      await expect(price).toContainText(lang === 'fr' ? '12,000 TND' : '12.000 TND');
      await expect(card.getByTestId('card-pack')).toContainText(lang === 'fr' ? '0,120 TND / pièce' : '0.120 TND / piece');
      for (const text of [await price.innerText(), await card.getByTestId('card-pack').innerText()]) {
        expect(text).not.toMatch(/\bHT\b|excl\.|#|\btags?\b/i);
      }
      await page.getByRole('button', { name: lang === 'fr' ? 'Affichage en liste' : /list/i }).click();
      await expect(card.locator('.card__price')).toContainText(lang === 'fr' ? '12,000 TND' : '12.000 TND');
    }
  });

  test('the detail page shows the photograph gallery and clean prices', async ({ page }) => {
    await page.goto('/fr/products/packaging/catalogue-paille-en-papier-230mm-x-8mm');
    // Two colours of the same straw: two photographs.
    await expect(page.locator('.pdp__thumbs img')).toHaveCount(2);
    const stage = page.locator('.pdp__stage img');
    await expect.poll(() => stage.evaluate((element: HTMLImageElement) => element.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.pdp__price')).toContainText('57,700 TND');
    expect(await page.locator('.pdp__price').innerText()).not.toMatch(/\bHT\b|#/);
  });
});
