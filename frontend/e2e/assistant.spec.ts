import { expect, test } from '@playwright/test';

test.describe('site assistant', () => {
  test('answers from the catalogue and returns focus when closed', async ({ page }) => {
    await page.goto('/fr');

    const launcher = page.getByRole('button', { name: 'Ouvrir l’assistant' });
    await launcher.click();

    const dialog = page.getByRole('dialog', { name: 'Comment pouvons-nous vous aider ?' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Votre question').fill('Quels produits proposez-vous ?');
    await dialog.getByRole('button', { name: 'Envoyer la question' }).click();

    await expect(dialog).toContainText(/\d+ références/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();
  });

  test('understands Tunisian Arabizi and links matching products', async ({ page }) => {
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Votre question').fill('3andkom bac polycarbonate?');
    await dialog.getByRole('button', { name: 'Envoyer la question' }).click();

    await expect(dialog).toContainText('Ey, l9it hedhouma fil catalogue');
    await expect(dialog.getByRole('link', { name: /Bac Polycarbonate Gn/ })).toBeVisible();
  });

  test('fits a narrow mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
