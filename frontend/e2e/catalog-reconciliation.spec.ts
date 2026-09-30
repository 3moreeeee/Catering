import { expect, Page, test } from '@playwright/test';

/**
 * The catalogue after its reconciliation with the supplier price lists
 * (src/app/data/catalog-reconciliation.data.ts): added lines can be found,
 * withdrawn ones cannot, corrected ones show the supplier format, in both
 * locales and at every supported width.
 */

const search = async (page: Page, locale: 'fr' | 'en', query: string) => {
  await page.goto(`/${locale}/products?q=${encodeURIComponent(query)}`);
  await expect(page.getByRole('status')).toContainText(/\d/);
  return page.locator('fk-product-card');
};

const LOCALES = [
  {
    locale: 'fr' as const,
    added: ['Bateau ovale 5.7cm x 9cm', 'Purée de lychee MONIN 1L', 'Pique trident 9cm', 'Maïs doux Emporium 3100ml', 'Sauce chocolat blanc MONIN'],
    // [search, card name, format badge]
    corrected: [['rond-carrée', 'Verrine rond-carrée 60ml', '60 ml'], ['Pique P', 'Pique P 13cm', '13 cm'], ['dentelle rectangulaire', 'rectangulaire 26cm x 36,5cm', 'Petit format 26cm x 36,5cm']] as const,
  },
  {
    locale: 'en' as const,
    added: ['Oval boat 5.7', 'lychee fruit purée', 'Trident pick', 'Sweetcorn Emporium 3100', 'white chocolate sauce'],
    corrected: [['Round-square verrine', 'Round-square verrine 60 ml', '60 ml'], ['P pick', 'P pick 13 cm', '13 cm'], ['Rectangular doily', 'Rectangular doily 26', 'Small format 26cm x 36,5cm']] as const,
  },
];

const WITHDRAWN = ['Maïs doux Emporium 800g', 'Planche à découper', 'Liquide Vaisselle', 'Essuie-tout', 'Bac gastronorme', 'fleur de sureau', 'concombre'];

for (const { locale, added, corrected } of LOCALES) {
  test.describe(`reconciled catalogue (${locale})`, () => {
    for (const query of added) {
      test(`finds the added line "${query}"`, async ({ page }) => {
        const cards = await search(page, locale, query);
        await expect(cards.first()).toBeVisible();
      });
    }

    test('no longer lists withdrawn products', async ({ page }) => {
      for (const query of WITHDRAWN) {
        const cards = await search(page, locale, query);
        await expect(cards, query).toHaveCount(0);
      }
    });

    for (const [query, name, format] of corrected) {
      test(`shows the supplier format for "${name}"`, async ({ page }) => {
        // Search is ranked, not filtered: pick the card by its corrected name.
        const card = (await search(page, locale, query)).filter({ hasText: name });
        await expect(card).toHaveCount(1);
        await expect(card).toContainText(format);
      });
    }
  });
}

test('an added line opens with the photograph the owner uploaded', async ({ page }) => {
  const card = (await search(page, 'fr', 'Pique trident 9cm')).filter({ hasText: 'Pique trident 9cm' });
  await expect(card).toHaveCount(1);
  await card.locator('.card__link').click();
  await expect(page).toHaveURL(/\/fr\/products\/packaging\/catalogue-pique-trident-9cm$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Pique trident 9cm/);
  await expect(page.locator('.pdp__stage img')).toHaveAttribute('src', /ik\.imagekit\.io\/.*\/img\/products\/admin\//);
});

test('division counts match the reconciled catalogue', async ({ page }) => {
  for (const [division, count] of [['food', 25], ['monin', 91], ['packaging', 156], ['hygiene', 21]] as const) {
    await page.goto(`/fr/products/${division}`);
    await expect(page.getByRole('status'), division).toContainText(String(count));
  }
});

test('the supplier size families are complete', async ({ page }) => {
  const family = async (query: string, name: string, sizes: readonly string[]) => {
    const cards = (await search(page, 'fr', query)).filter({ hasText: name });
    await expect(cards).toHaveCount(sizes.length);
    const text = (await cards.allInnerTexts()).join(' ');
    for (const size of sizes) expect(text, name).toContain(size);
  };
  await family('Champignons', 'Champignons en tranches Emporium', ['184g', '425g', '850g']);
  await family('Moutarde', 'Moutarde forte de Dijon', ['200gr', '370gr', '850gr']);
  await family('Bateau ovale', 'Bateau ovale', ['5.7cm x 9cm', '7cm x 12cm', '8cm x 13.5cm']);
  await family('Bol à soupe', 'carton blanc', ['500ml', '1100ml']);
});

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test(`no horizontal overflow or console error at ${viewport.width}×${viewport.height}`, async ({ context }) => {
    for (const path of [
      '/fr/products/packaging',
      '/en/products/monin',
      '/fr/products/monin/monin-puree-lychee-1l',
      '/en/products/packaging/vinto-verrine-goutte-11ml-les-50-pieces-348',
    ]) {
      // One tab per page: navigating a tab away while its price request is in
      // flight makes WebKit log the cancelled fetch as a console error, which
      // is an artefact of the test rather than of the page.
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        // Photographs of the added lines are only on ImageKit once uploaded; the
        // card then falls back to the placeholder. Any other error counts.
        if (/Failed to load resource/.test(message.text())) return;
        errors.push(message.text());
      });
      await page.setViewportSize(viewport);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('fk-product-card, .pdp__stage img').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(1);
      expect(errors, path).toEqual([]);
      page.removeAllListeners();
      await page.close();
    }
  });
}
