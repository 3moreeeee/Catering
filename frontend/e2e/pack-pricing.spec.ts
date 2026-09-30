import { APIRequestContext, expect, Page, test } from '@playwright/test';

/**
 * Pack-only sales end to end, against a live backend (not mocks): the supplier
 * price of Bonnet de douche is 0,120 HT a cap, sold by 100.
 *
 * The admin scenarios need the administrator created by AdminBootstrap:
 * E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD. Without them they are skipped.
 */

const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'];
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'];
const BONNET = '/fr/products/hygiene/catalogue-bonnet-de-douche';

async function signUpBuyer(request: APIRequestContext): Promise<string> {
  const email = `pack-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.test`;
  const response = await request.post('/api/auth/register', {
    data: { clientType: 'PHYSIQUE', firstName: 'Test', lastName: 'Lot', email, password: 'StrongPassword123!' },
  });
  expect(response.ok()).toBe(true);
  return email;
}

async function signInAdmin(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(response.ok()).toBe(true);
}

/** Withdraws the products a test created, so catalogue counts elsewhere are not skewed. */
async function withdraw(page: Page, name: string): Promise<void> {
  const found = await page.request.get('/api/admin/products', { params: { q: name, page: 0, pageSize: 25 } });
  const { items } = (await found.json()) as { items: { id: string }[] };
  for (const item of items) await page.request.delete(`/api/products/${item.id}`);
}

test.describe('pack pricing — storefront', () => {
  test('the card leads with the pack price, then the pack and the piece price (FR)', async ({ page }) => {
    await page.goto('/fr/products?q=Bonnet%20de%20douche');
    const card = page.locator('fk-product-card').filter({ hasText: 'Bonnet de douche' });
    await expect(card).toContainText('12,000 TND / lot');
    await expect(card.getByTestId('card-pack')).toContainText('Vendu par lot de 100 pièces');
    await expect(card.getByTestId('card-pack')).toContainText('0,120 TND / pièce');
  });

  test('the card reads in English too', async ({ page }) => {
    await page.goto('/en/products?q=Shower%20cap');
    const card = page.locator('fk-product-card').filter({ hasText: 'Shower cap' });
    await expect(card).toContainText('12.000 TND / pack');
    await expect(card.getByTestId('card-pack')).toContainText('Sold in packs of 100 pieces');
  });

  test('a supplier size family shows its official formats and prices', async ({ page }) => {
    await page.goto('/fr/products?q=Champignons');
    const cards = page.locator('fk-product-card').filter({ hasText: 'Champignons en tranches Emporium' });
    await expect(cards).toHaveCount(3);
    await expect(cards.filter({ hasText: '184g' })).toContainText('68,400 TND / lot');
    await expect(cards.filter({ hasText: '184g' }).getByTestId('card-pack')).toContainText('Vendu par lot de 24 boîtes');
    await expect(cards.filter({ hasText: '850g' })).toContainText('80,400 TND / lot');
  });

  test('the detail page, the panier and the quote count packs, never pieces', async ({ page }) => {
    const buyer = await signUpBuyer(page.request);
    await page.goto(BONNET);

    const terms = page.getByTestId('pdp-pack');
    await expect(terms).toContainText('0,120 TND / pièce');
    await expect(terms).toContainText('100 pièces');
    await expect(terms).toContainText('0,120 TND × 100');
    await expect(terms).toContainText('12,000 TND');
    await expect(page.getByText('Nombre de lots', { exact: true })).toBeVisible();

    const total = page.getByTestId('pdp-pack-total');
    await expect(total).toContainText('1 lot = 100 pièces');
    await expect(total).toContainText('12,000 TND');
    await page.getByRole('button', { name: /augmenter|increase/i }).click();
    await expect(total).toContainText('2 lots = 200 pièces');
    await expect(total).toContainText('24,000 TND');

    await page.locator('.pdp__add').click();
    await expect(page.locator('.pdp__added')).toBeVisible();

    await page.goto('/fr/cart');
    const line = page.locator('.cart-line').filter({ hasText: 'Bonnet de douche' });
    await expect(line.getByTestId('cart-pieces')).toHaveText('2 lots = 200 pièces');
    await expect(line.getByTestId('cart-pack')).toContainText('100 pièces / lot');
    await expect(line.locator('.cart-line__total')).toContainText('24,000 TND');

    const quantity = line.locator('input.qty__input');
    await quantity.fill('5');
    await quantity.press('Enter');
    await expect(line.getByTestId('cart-pieces')).toHaveText('5 lots = 500 pièces');
    await expect(line.locator('.cart-line__total')).toContainText('60,000 TND');

    await page.getByRole('button', { name: /Demander un devis/i }).first().click();
    await page.locator('.cart-form button[type="submit"]').click();
    await expect(page.locator('.cart-confirmation')).toBeVisible();

    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'administrator credentials not provided');
    await signInAdmin(page);
    await page.goto('/fr/admin/quotes');
    await page.getByRole('button', { name: new RegExp(buyer.replace(/[.+]/g, '\\$&')) }).click();
    const packLine = page.getByTestId('quote-pack-qty').first();
    await expect(packLine).toContainText('5 lots × 100 pièces');
    await expect(packLine).toContainText('500 pièces');
  });
});

test.describe('pack pricing — back office', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'administrator credentials not provided');

  test('adds a pack product with a live preview, then edits its pack size and unit price', async ({ page }) => {
    const name = `Produit lot e2e ${Date.now()}`;
    await signInAdmin(page);
    await page.goto('/fr/admin/products');

    await page.getByRole('button', { name: 'Ajouter un produit' }).click();
    await page.locator('#p-name-fr').fill(name);
    await page.locator('#p-category').selectOption('hygiene');
    await page.locator('#p-sale-mode').selectOption('PACK_ONLY');
    await page.locator('#p-unit-price').fill('0,120');
    await page.locator('#p-pack-qty').fill('100');
    await expect(page.getByTestId('pack-price')).toHaveText('12,000 TND');
    await expect(page.getByTestId('pack-preview')).toContainText('Vendu par lot de 100 pièces');
    await page.locator('#p-pack-qty').fill('200');
    await expect(page.getByTestId('pack-price')).toHaveText('24,000 TND');

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Produit créé.' })).toBeVisible();

    await page.locator('#p-search').fill(name);
    await page.locator('#p-search').press('Enter');
    const row = page.locator('tr').filter({ hasText: name });
    await expect(row.getByTestId('list-pack-price')).toContainText('24,000 TND');

    // Edit: the form reopens with the saved terms, and a new pack re-prices it.
    await row.getByRole('button', { name: 'Modifier' }).click();
    await expect(page.locator('#p-unit-price')).toHaveValue('0.120');
    await expect(page.locator('#p-pack-qty')).toHaveValue('200');
    await page.locator('#p-unit-price').fill('0,125');
    await page.locator('#p-pack-qty').fill('50');
    await expect(page.getByTestId('pack-price')).toHaveText('6,250 TND');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Produit mis à jour.' })).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: name }).getByTestId('list-pack-price')).toContainText('6,250 TND');
    await withdraw(page, name);
  });

  test('rejects an invalid pack before sending it', async ({ page }) => {
    await signInAdmin(page);
    await page.goto('/fr/admin/products');
    await page.getByRole('button', { name: 'Ajouter un produit' }).click();
    await page.locator('#p-name-fr').fill(`Produit invalide ${Date.now()}`);
    await page.locator('#p-category').selectOption('hygiene');
    await page.locator('#p-sale-mode').selectOption('PACK_ONLY');
    await page.locator('#p-unit-price').fill('0');
    await page.locator('#p-pack-qty').fill('100.5');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('#p-unit-price')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#p-pack-qty')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('pack-price')).toHaveText('—');
  });

  test('adds and edits a unit-priced product the way it always worked', async ({ page }) => {
    const name = `Produit unité e2e ${Date.now()}`;
    await signInAdmin(page);
    await page.goto('/fr/admin/products');
    await page.getByRole('button', { name: 'Ajouter un produit' }).click();
    await page.locator('#p-name-fr').fill(name);
    await page.locator('#p-category').selectOption('monin');
    await page.locator('#p-price').fill('12,5');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Produit créé.' })).toBeVisible();

    await page.locator('#p-search').fill(name);
    await page.locator('#p-search').press('Enter');
    const row = page.locator('tr').filter({ hasText: name });
    await expect(row.locator('input.admin-price__input')).toHaveValue('12.500');

    await row.getByRole('button', { name: 'Modifier' }).click();
    await page.locator('#p-price').fill('13');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Produit mis à jour.' })).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: name }).locator('input.admin-price__input')).toHaveValue('13.000');
    await withdraw(page, name);
  });
});
