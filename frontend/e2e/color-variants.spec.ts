import { expect, test } from '@playwright/test';

const search = '/fr/products/packaging?q=Verrine%20goutte';

test('one drop-verrine card leads to a required colour choice and the selected SKU', async ({
  page,
}) => {
  const cartProducts: string[] = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) {
      await route.fulfill({
        json: {
          id: 'variant-test',
          role: 'CUSTOMER',
          clientType: 'PHYSIQUE',
          email: 'variant@example.test',
        },
      });
    } else if (url.pathname.endsWith('/products/prices')) {
      const ids = url.searchParams.get('sourceIds')?.split(',') ?? [];
      await route.fulfill({
        json: ids.map((sourceId) => ({
          sourceId,
          id: `db-${sourceId}`,
          price: 17.8,
          originalPrice: 17.8,
          offerActive: false,
          currency: 'TND',
          active: true,
        })),
      });
    } else if (route.request().method() === 'GET' && url.pathname.startsWith('/api/products')) {
      // The catalogue itself is read from the database.
      await route.continue();
    } else if (url.pathname.endsWith('/cart/items')) {
      cartProducts.push(route.request().postDataJSON().productId);
      await route.fulfill({ json: { items: [], itemCount: 1, totalQuantity: 1 } });
    } else {
      await route.abort();
    }
  });

  await page.goto(search);
  await expect(page.locator('fk-product-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Choisir une couleur' }).click();
  await expect(page.locator('.pdp__color-option')).toHaveCount(2);
  await expect(page.locator('.pdp__color-option[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.pdp__add')).toBeDisabled();

  await page.getByRole('button', { name: 'Noire' }).click();
  await expect(page.locator('.pdp__add')).toBeEnabled();
  await page.locator('.pdp__add').click();
  await expect.poll(() => cartProducts).toEqual(['db-p-vinto-183']);
});

test('an old black-variant link resolves to the consolidated product with black selected', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/fr/products/packaging/vinto-verrine-goutte-11ml-les-50-pieces-183');
  await expect(page.locator('.pdp__color-option')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Noire' })).toHaveAttribute('aria-pressed', 'true');
});
