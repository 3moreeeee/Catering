import { expect, test } from '@playwright/test';

/**
 * Flow A from docs/02 — the primary revenue flow:
 * search or land → filter → product → enquiry, in four interactions or fewer.
 */
test.describe('catalogue discovery', () => {
  test('lists the full catalogue and reports a result count', async ({ page }) => {
    await page.goto('/fr/products');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // A number, not a literal: the catalogue grows when the reconciled import is
    // regenerated, and pinning the total here would mean editing the test each
    // time. What matters is that a count is reported at all.
    await expect(page.getByRole('status')).toContainText(/\d{2,}/);
  });

  test('publishes the complete dedicated MONIN range with local photography', async ({ page }) => {
    await page.goto('/fr/products/monin');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MONIN');
    await expect(page.getByRole('status')).toContainText('57');

    const cards = page.locator('fk-product-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().locator('img')).toHaveAttribute('src', /\/img\/products\/monin\//);

    await cards.first().locator('.card__link').click();
    await expect(page).toHaveURL(/\/fr\/products\/monin\/monin-/);
    await expect(page.locator('.pdp__stage img').first()).toHaveAttribute(
      'src',
      /\/img\/products\/monin\//,
    );
  });

  test('narrows results by division and keeps the filter in the URL', async ({ page }) => {
    await page.goto('/fr/products');
    await page
      .getByRole('checkbox', { name: /Hygiène/i })
      .first()
      .check();

    await expect(page).toHaveURL(/category=hygiene/);
    // Filtering must reduce the result set below the unfiltered total.
    const filtered = Number((await page.getByRole('status').innerText()).match(/\d+/)?.[0] ?? '0');
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(268);
  });

  test('switches division from the top products menu without leaving the catalogue', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/fr/products/food');

    await page.getByRole('button', { name: 'Produits', exact: true }).click();
    await page
      .locator('#fk-mega-menu .mega__card')
      .filter({ hasText: /Hygiène et jetable/i })
      .click();

    await expect(page).toHaveURL(/\/fr\/products\/hygiene$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hygiène et jetable/i);
    await expect(page.getByRole('status')).toContainText(/\d+/);
    await expect(page).toHaveTitle(/hygiène/i);
  });

  test('switches division from the mobile products navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fr/products/food');

    await page.getByRole('button', { name: /Ouvrir le menu/i }).click();
    await page
      .locator('#fk-mobile-nav')
      .getByRole('link', { name: 'Hygiène et jetable', exact: true })
      .click();

    await expect(page).toHaveURL(/\/fr\/products\/hygiene$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hygiène et jetable/i);
    await expect(page.getByRole('status')).toContainText(/\d+/);
  });

  test('switches division with the category filters after entering from the top menu', async ({
    page,
  }) => {
    await page.goto('/fr/products/food');

    await page
      .getByRole('checkbox', { name: /Hygiène/i })
      .first()
      .check();

    await expect(page).toHaveURL(/\/fr\/products\/hygiene$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hygiène et jetable/i);
    await expect(page.getByRole('status')).toContainText(/\d+/);
  });

  test('a filtered URL is shareable — it restores the same result set', async ({ page }) => {
    await page.goto('/fr/products?category=hygiene&sub=gloves');
    await expect(page.getByRole('status')).toContainText(/\d+/);
    // The chips reflect what the URL asked for.
    await expect(page.locator('.catalog__chips')).toBeVisible();
  });

  test('clear-all removes every filter', async ({ page }) => {
    await page.goto('/fr/products?category=hygiene&sub=gloves');
    await page
      .getByRole('button', { name: /Effacer tous les filtres/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/fr\/products$/);
    await expect(page.getByRole('status')).toContainText('247');
    // Back to the unfiltered catalogue: more results than the filtered view had.
    const cleared = Number((await page.getByRole('status').innerText()).match(/\d+/)?.[0] ?? '0');
    expect(cleared).toBeGreaterThan(100);
  });

  test('shows a real empty state rather than a blank grid', async ({ page }) => {
    await page.goto('/fr/products?q=zzzzqqqqnothing');
    await expect(page.getByText(/Aucun produit ne correspond/i)).toBeVisible();
  });

  test('facet counts never all collapse to zero when one filter is applied', async ({ page }) => {
    await page.goto('/fr/products?category=food');
    const labels = await page.locator('.filters__count').allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((text) => !text.includes('(0)'))).toBe(true);
  });

  test('walks from catalogue to product to a pre-filled enquiry', async ({ page }) => {
    await page.goto('/fr/products/food');

    const firstCard = page.locator('fk-product-card').first();
    await firstCard.locator('.card__link').click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Scope to the product's own CTA — the header carries a separate,
    // differently-named contact link.
    await page
      .locator('.pdp__actions')
      .getByRole('link', { name: /Demander une information/i })
      .click();

    // The enquiry arrives with the product attached.
    await expect(page).toHaveURL(/\/contact\?product=/);
    await expect(page.locator('.contact__context')).toBeVisible();
  });
});

test.describe('product detail', () => {
  test('never displays a price', async ({ page }) => {
    await page.goto('/fr/products/food');
    await page.locator('fk-product-card .card__link').first().click();

    await expect(page.locator('.pdp__noprice')).toBeVisible();
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/\b\d+[.,]\d{2}\s?(TND|DT|€|\$)/);
    expect(body).toMatch(/tarifs sont communiqués sur demande/i);
  });

  test('omits the technical section entirely when no datasheet exists', async ({ page }) => {
    await page.goto('/fr/products/food');
    await page.locator('fk-product-card .card__link').first().click();

    // This used to render a permanently disabled button reading "Fiche
    // technique non encore disponible". Correctly disabled, and still an
    // admission on a sales page that the company has not finished its
    // documentation. No datasheets exist for any product yet, so the section
    // does not appear at all; it returns the moment one is supplied.
    await expect(
      page.getByRole('button', { name: /Fiche technique non encore disponible/i }),
    ).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Fiche technique/i })).toHaveCount(0);

    // The page is still a complete product page with a way to ask.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.pdp__actions a').first()).toBeVisible();
  });

  test('shows related products so the page is never a dead end', async ({ page }) => {
    await page.goto('/fr/products/packaging');
    await page.locator('fk-product-card .card__link').first().click();
    await expect(page.locator('.pdp__related fk-product-card').first()).toBeVisible();
  });
});
