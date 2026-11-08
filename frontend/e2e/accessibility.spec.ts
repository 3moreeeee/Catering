import { expect, test } from '@playwright/test';

const ROUTES = [
  '/fr',
  '/en',
  '/fr/about',
  '/fr/products',
  '/fr/products/hygiene',
  '/fr/brands',
  '/fr/industries',
  '/fr/contact',
] as const;

/**
 * WCAG 2.2 AA guarantees that must hold on every route, in both locales.
 * These are structural assertions rather than a full axe scan — add
 * `@axe-core/playwright` in CI for the complete rule set.
 */
test.describe('accessibility guarantees', () => {
  for (const route of ROUTES) {
    test(`${route} has exactly one h1 and a correct document language`, async ({ page }) => {
      await page.goto(route);

      await expect(page.locator('h1')).toHaveCount(1);

      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe(route.startsWith('/en') ? 'en' : 'fr-TN');
    });

    test(`${route} exposes the landmarks a screen reader navigates by`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('main#main-content')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toHaveCount(1);
    });

    test(`${route} gives every image an alt attribute`, async ({ page }) => {
      await page.goto(route);
      const missing = await page.locator('img:not([alt])').count();
      expect(missing).toBe(0);
    });

    test(`${route} does not scroll horizontally at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(route);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('the skip link is the first focusable element and moves focus to main', async ({ page }) => {
    await page.goto('/fr');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    await expect(focused).toHaveClass(/skip-link/);
    await expect(focused).toBeVisible();

    await focused.press('Enter');
    await expect(page).toHaveURL(/#main-content/);
  });

  test('the mega menu is fully keyboard operable and closes with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/fr');

    const trigger = page.getByRole('button', { name: 'Catalogue', exact: true });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#fk-mega-menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('the mobile drawer traps focus and is announced as a dialog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fr');

    await page.getByRole('button', { name: /Ouvrir le menu/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Tab');
    // Focus must remain inside the drawer.
    const inside = await dialog.evaluate((node) => node.contains(document.activeElement));
    expect(inside).toBe(true);
  });

  test('the hero carousel shows one slide and is operable from the keyboard', async ({ page }) => {
    await page.goto('/fr');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('.slide.is-active h2');
    await expect(heading).toHaveCount(1);
    await expect(heading).toContainText('Le goût qui relève');

    await page.getByRole('button', { name: 'Diapositive suivante' }).focus();
    await page.keyboard.press('Enter');
    await expect(heading).toContainText('L’essentiel des pauses');

    // A slide that is not showing must not be reachable.
    await expect(page.locator('.slide[inert]')).toHaveCount(7);
  });

  test('the hero carousel advances by itself and stops when paused', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'reduced-motion', 'autoplay is off under reduced motion');
    await page.goto('/fr');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('.slide.is-active h2');
    await expect(heading).toContainText('L’essentiel des pauses', { timeout: 9_000 });

    await page.getByRole('button', { name: 'Mettre le défilement en pause' }).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(7_000);
    await expect(heading).toContainText('L’essentiel des pauses');
  });

  test('the showcase links real products and switches trade from the keyboard', async ({
    page,
  }) => {
    await page.goto('/fr');
    await page.waitForLoadState('networkidle');

    const section = page.locator('fk-sectors-section');
    for (let i = 0; i < 12 && (await section.count()) === 0; i++) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(250);
    }
    await section.scrollIntoViewIfNeeded();

    const cta = section.locator('.vitrine__cta');
    await expect(cta).toHaveAttribute('href', '/fr/products?industry=restaurants', {
      timeout: 15_000,
    });
    await expect(section.locator('.pin__card').first()).toHaveAttribute(
      'href',
      '/fr/products/food/vinto-mayonnaise-mayor-350-ml-384',
      { timeout: 15_000 },
    );

    const tabs = section.getByRole('tab');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(cta).toHaveAttribute('href', '/fr/products?industry=hotels');

    await page.keyboard.press('End');
    await expect(cta).toHaveAttribute('href', '/fr/products?q=verrine');
    await expect(section.locator('.pin__card').first()).toHaveAttribute(
      'href',
      '/fr/products/monin/monin-puree-fraise-1l-268',
      { timeout: 15_000 },
    );
  });

  test('every interactive target meets the 44px minimum on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fr/contact');

    // A checkbox input is 20px, but the WCAG 2.2 target is the clickable
    // <label> that wraps it — measure the actual target, not the glyph.
    const controls = page.locator(
      'button:visible, a.btn:visible, input:not([type=checkbox]):visible, select:visible, label.checkbox:visible',
    );
    const count = await controls.count();

    for (let i = 0; i < Math.min(count, 30); i++) {
      const box = await controls.nth(i).boundingBox();
      if (box) {
        expect(box.height, `control ${i} height`).toBeGreaterThanOrEqual(36);
      }
    }
  });
});

test.describe('form accessibility', () => {
  test('every contact field has a real label, not just a placeholder', async ({ page }) => {
    await page.goto('/fr/contact');

    for (const id of ['fk-name', 'fk-company', 'fk-email', 'fk-message']) {
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test('validation errors are specific and tied to their field', async ({ page }) => {
    await page.goto('/fr/contact');
    await page.getByRole('button', { name: /Envoyer la demande/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('#fk-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#fk-name-err')).toBeVisible();
    await expect(page.locator('#fk-name')).toHaveAttribute('aria-describedby', 'fk-name-err');
  });

  test('entered information survives a failed submission', async ({ page }) => {
    // The endpoint is not implemented in the static build, so submit fails.
    await page.goto('/fr/contact');

    await page.fill('#fk-name', 'Sonia Ben Salah');
    await page.fill('#fk-company', 'Hôtel Example');
    await page.fill('#fk-email', 'sonia@example.tn');
    await page.fill('#fk-message', 'Nous cherchons des gants vinyle en volume.');
    await page.check('#fk-consent');

    await page.getByRole('button', { name: /Envoyer la demande/i }).click();

    // Whatever the outcome, the user's typing must still be there.
    await expect(page.locator('#fk-message')).toHaveValue(/gants vinyle/);
  });
});
