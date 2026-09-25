import { expect, test } from '@playwright/test';

/**
 * Live data must reach the home page's deferred sections with no interaction.
 *
 * The sections are `@defer (on viewport; hydrate on viewport)`. Until they
 * hydrate, their product cards are inert server HTML and never ask for prices.
 * A bootstrap-order defect once left every `hydrate on viewport` trigger
 * unregistered, so prices appeared only after a click replayed an event. This
 * test scrolls — it never clicks — and answers the price request late, as a
 * waking backend would, then expects the price to land on its own.
 */
for (const lang of ['fr', 'en'] as const) {
  test(`/${lang}: featured prices load without any click (slow backend)`, async ({ page }) => {
    let priceRequests = 0;
    await page.route('**/api/products/prices**', async (route) => {
      priceRequests++;
      const ids = (new URL(route.request().url()).searchParams.get('sourceIds') ?? '').split(',');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        json: ids.map((sourceId) => ({
          sourceId,
          id: sourceId,
          slug: sourceId,
          price: 42.5,
          originalPrice: 42.5,
          offerActive: false,
          currency: 'TND',
          stockQuantity: null,
          active: true,
        })),
      });
    });

    await page.goto(`/${lang}`);
    await page.evaluate(() => document.querySelector('fk-featured-section')?.scrollIntoView());

    const featured = page.locator('fk-featured-section');
    await expect(featured.locator('.card__price--pending').first()).toBeVisible();
    await expect(featured.locator('.card__price strong').first()).toBeVisible({ timeout: 15_000 });
    await expect(featured.locator('.card__price strong').first()).toContainText('42');
    expect(priceRequests).toBeGreaterThan(0);
  });
}
