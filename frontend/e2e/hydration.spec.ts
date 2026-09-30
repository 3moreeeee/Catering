import { expect, test } from '@playwright/test';

/**
 * Live data must reach the home page's deferred sections with no interaction.
 *
 * The sections are `@defer (on viewport; hydrate on viewport)`. A bootstrap-order
 * defect once left every `hydrate on viewport` trigger unregistered, so prices
 * appeared only after a click replayed an event. Prices now arrive with the
 * catalogue responses the server renders from, so the featured cards carry
 * their price in the server HTML and keep it through hydration: this test
 * scrolls — it never clicks — and expects the price without any separate price
 * request, even with that endpoint made slow.
 */
for (const lang of ['fr', 'en'] as const) {
  test(`/${lang}: featured prices are shown without any click or price request`, async ({
    page,
  }) => {
    let priceRequests = 0;
    await page.route('**/api/products/prices**', async (route) => {
      priceRequests++;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });

    const response = await page.goto(`/${lang}`);
    // In the HTML the server sent, before any script ran.
    expect(await response!.text()).toMatch(/card__price[^>]*>[\s\S]{0,400}?\d+[.,]\d{3}\s*TND/);

    await page.evaluate(() => document.querySelector('fk-featured-section')?.scrollIntoView());
    const featured = page.locator('fk-featured-section');
    await expect(featured.locator('.card__price strong').first()).toBeVisible();
    await expect(featured.locator('.card__price strong').first()).toContainText(/\d+[.,]\d{3}/);
    await expect(featured.locator('.card__price--pending')).toHaveCount(0);
    expect(priceRequests).toBe(0);
  });
}
