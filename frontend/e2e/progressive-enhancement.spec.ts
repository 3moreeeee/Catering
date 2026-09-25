import { expect, test } from '@playwright/test';

/**
 * The acceptance criterion from docs/06 §6.5:
 * the site is fully usable, fully indexable and visually complete without
 * WebGL, without JavaScript, and with motion disabled.
 */

test.describe('without WebGL', () => {
  test.beforeEach(async ({ page }) => {
    // Block WebGL before any application code runs.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
          return null;
        }
        // eslint-disable-next-line prefer-rest-params
        return original.apply(this, arguments as never);
      } as typeof original;
    });
  });

  test('the homepage renders complete content and never loads the three chunk', async ({
    page,
  }) => {
    const threeRequests: string[] = [];
    page.on('request', (request) => {
      if (/three/i.test(request.url())) {
        threeRequests.push(request.url());
      }
    });

    await page.goto('/fr');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The opening frame is a poster image, never a canvas and never a video
    // element: the hero's LCP candidate is an AVIF still that decodes on its
    // own, so the hero is complete before any enhancement arrives.
    const poster = page.locator('fk-hero-section .cm__poster img');
    await expect(poster).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);

    expect(threeRequests, 'three.js must not be fetched when WebGL is unavailable').toEqual([]);
  });

  test('the three divisions are still reachable as real links', async ({ page }) => {
    await page.goto('/fr');
    // Everything the opening film depicts is stated in adjacent HTML: the
    // category index labels each division and links straight into it.
    await expect(page.locator('.hero__category')).toHaveCount(3);
    await page.locator('.hero__category').first().click();
    await expect(page).toHaveURL(/\/products\//);
  });
});

test.describe('with motion reduced', () => {
  // `test.use({ reducedMotion })` inside a describe is overridden by the
  // project-level device spread, so emulate the preference explicitly.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('all content is visible — no element is left at opacity 0', async ({ page }) => {
    await page.goto('/fr');
    await page.waitForLoadState('networkidle');
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
      await page.waitForTimeout(200);
    }

    const invisible = await page.evaluate(() => {
      const candidates = document.querySelectorAll('main h2, main h3, main p');
      let hidden = 0;
      for (const node of candidates) {
        const style = getComputedStyle(node);
        if (style.opacity === '0' && style.display !== 'none') {
          hidden++;
        }
      }
      return hidden;
    });

    expect(invisible, 'reduced-motion users must never see invisible content').toBe(0);
  });

  test('nothing on the page loops forever', async ({ page }) => {
    await page.goto('/fr');
    // The tail of the homepage sits behind several sequential
    // `@defer (on viewport)` blocks. Each one only resolves once it enters the
    // viewport, and resolving it grows the page — so a single jump to the
    // bottom lands short. Walk down the page the way a real reader would.
    await page.waitForLoadState('networkidle');
    const brands = page.locator('fk-brands-section');

    for (let i = 0; i < 20 && (await brands.count()) === 0; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
      await page.waitForTimeout(300);
    }

    await expect(brands).toBeVisible({ timeout: 15_000 });

    // The guarantee is not about one component — it is that a reader who has
    // asked for less motion is never given something that moves indefinitely.
    const looping = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('body *')].filter((node) => {
          const style = getComputedStyle(node);
          return (
            style.animationName !== 'none' &&
            style.animationIterationCount === 'infinite' &&
            style.animationPlayState === 'running'
          );
        }).length,
    );
    expect(looping, 'reduced-motion users must never be shown an endless animation').toBe(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the prerendered homepage carries its content and metadata', async ({ page }) => {
    await page.goto('/fr');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test('the catalogue is server-rendered with real products', async ({ page }) => {
    await page.goto('/fr/products');
    const cards = page.locator('fk-product-card');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('a product page is server-rendered with Product structured data', async ({ page }) => {
    await page.goto('/fr/products/hygiene');
    const href = await page.locator('fk-product-card .card__link').first().getAttribute('href');
    await page.goto(href!);

    const jsonLd = await page.locator('script[type="application/ld+json"]').innerText();
    expect(jsonLd).toContain('"Product"');
    expect(jsonLd).toContain('"BreadcrumbList"');
    // No price may reach search results.
    expect(jsonLd).not.toContain('"offers"');
  });
});

test.describe('SEO surface', () => {
  test('each locale declares the correct canonical and hreflang set', async ({ page }) => {
    for (const [locale, other] of [
      ['fr', 'en'],
      ['en', 'fr'],
    ] as const) {
      await page.goto(`/${locale}/about`);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`/${locale}/about$`),
      );
      await expect(page.locator(`link[hreflang="${other}"]`)).toHaveCount(1);
      await expect(page.locator('link[hreflang="x-default"]')).toHaveCount(1);
    }
  });

  test('filtered catalogue views are excluded from the index', async ({ page }) => {
    await page.goto('/fr/products?category=hygiene');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('legacy WordPress URLs redirect to their new equivalents', async ({ page }) => {
    await page.goto('/agro-alimentaire/');
    await expect(page).toHaveURL(/\/fr\/products\/food/);
  });
});
