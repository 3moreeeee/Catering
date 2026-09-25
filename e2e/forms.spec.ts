import { expect, test } from '@playwright/test';

/**
 * The forms must never claim to have done something they have not done.
 *
 * Before these tests existed the enquiry form told buyers their message had
 * been received — and gave them a reference number to quote — for a submission
 * that went nowhere: there was no `/api/contact` route, the POST fell through
 * to the Angular renderer, and `200 text/html` was read as confirmation. The
 * client then invented `FK-<timestamp>` when the body would not parse.
 *
 * Everything here is about that class of failure. A green tick is a promise to
 * a commercial visitor, and it has to be backed by the server.
 */

test.describe('enquiry API', () => {
  const valid = {
    name: 'Amel Ben Salah',
    company: 'Groupe Test',
    email: 'amel@example.tn',
    phone: '',
    message: 'Bonjour, nous cherchons un fournisseur de verrines monoportion.',
    department: 'sales',
    locale: 'fr',
    productSlug: null,
    consent: true,
  };

  test('answers JSON, never the rendered page', async ({ request }) => {
    const response = await request.post('/api/contact', { data: valid });
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('refuses to confirm while no delivery channel is configured', async ({ request }) => {
    const response = await request.post('/api/contact', { data: valid });
    // 503 when unconfigured, 429 if an earlier test in the run used the window.
    expect([503, 429]).toContain(response.status());

    const body = (await response.json()) as Record<string, unknown>;
    expect(body['ok']).toBe(false);
    // The reference is the thing a buyer would quote on the phone. It must not
    // exist unless the enquiry does.
    expect(body).not.toHaveProperty('reference');
  });

  test('validates on the server, not only in the browser', async ({ request }) => {
    const response = await request.post('/api/contact', {
      data: { name: '', email: 'not-an-address', message: 'x', consent: false },
    });
    if (response.status() === 429) test.skip(true, 'rate limit window already spent');

    expect(response.status()).toBe(422);
    const body = (await response.json()) as { fields: string[] };
    expect(body.fields).toEqual(expect.arrayContaining(['name', 'email', 'message', 'consent']));
  });

  test('an unimplemented API route is a JSON 404, never a page', async ({ request }) => {
    const response = await request.post('/api/does-not-exist', { data: {} });
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('rate limits repeated submissions', async ({ request }) => {
    let limited = false;
    for (let i = 0; i < 10 && !limited; i++) {
      const response = await request.post('/api/newsletter', {
        data: { email: `flood${i}@example.com`, locale: 'fr' },
      });
      limited = response.status() === 429;
    }
    expect(limited).toBe(true);
  });
});

test.describe('enquiry form', () => {
  test('reports failure, invents no reference, and keeps every answer', async ({ page }) => {
    const MESSAGE = 'Nous cherchons un fournisseur de verrines monoportion pour trois sites.';
    await page.goto('/fr/contact');

    await page.fill('#fk-name', 'Amel Ben Salah');
    await page.fill('#fk-company', 'Groupe Test');
    await page.fill('#fk-email', 'amel@example.tn');
    await page.fill('#fk-message', MESSAGE);
    await page.check('#fk-consent');
    await page.getByRole('button', { name: /Envoyer la demande/i }).click();

    const alert = page.locator('[role=alert]').first();
    await expect(alert).toBeVisible();

    // No success wording, and above all no fabricated reference.
    await expect(alert).not.toContainText(/FK-\w{4,}/i);
    await expect(page.getByText(/Votre demande a bien été/i)).toHaveCount(0);

    // Nothing the visitor typed is lost to a failed send.
    await expect(page.locator('#fk-message')).toHaveValue(MESSAGE);
    await expect(page.locator('#fk-name')).toHaveValue('Amel Ben Salah');
    await expect(page.locator('#fk-email')).toHaveValue('amel@example.tn');
    await expect(page.locator('#fk-company')).toHaveValue('Groupe Test');
  });

  test('rejects an HTML response as a failure rather than a success', async ({ page }) => {
    // The exact shape of the original defect: a 200 that is not JSON.
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>ok</p>' }),
    );

    await page.goto('/fr/contact');
    await page.fill('#fk-name', 'Test Buyer');
    await page.fill('#fk-company', 'Groupe Test');
    await page.fill('#fk-email', 'buyer@example.tn');
    await page.fill('#fk-message', 'Une demande de prix pour des gants vinyle.');
    await page.check('#fk-consent');
    await page.getByRole('button', { name: /Envoyer la demande/i }).click();

    await expect(page.locator('[role=alert]').first()).toBeVisible();
    await expect(page.locator('#fk-message')).toHaveValue(/gants vinyle/);
  });

  test('rejects a JSON success that carries no reference', async ({ page }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' }),
    );

    await page.goto('/fr/contact');
    await page.fill('#fk-name', 'Test Buyer');
    await page.fill('#fk-company', 'Groupe Test');
    await page.fill('#fk-email', 'buyer@example.tn');
    await page.fill('#fk-message', 'Une demande de prix pour des gants vinyle.');
    await page.check('#fk-consent');
    await page.getByRole('button', { name: /Envoyer la demande/i }).click();

    await expect(page.locator('[role=alert]').first()).toBeVisible();
  });

  test('confirms only when the server confirms, with the server’s reference', async ({ page }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, reference: 'FK-260831-7QX2' }),
      }),
    );

    await page.goto('/fr/contact');
    await page.fill('#fk-name', 'Test Buyer');
    await page.fill('#fk-company', 'Groupe Test');
    await page.fill('#fk-email', 'buyer@example.tn');
    await page.fill('#fk-message', 'Une demande de prix pour des gants vinyle.');
    await page.check('#fk-consent');
    await page.getByRole('button', { name: /Envoyer la demande/i }).click();

    await expect(page.getByText('FK-260831-7QX2')).toBeVisible();
  });
});

test.describe('newsletter', () => {
  test('does not navigate, does not claim success, and keeps the address', async ({ page }) => {
    await page.goto('/fr');
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(100);
    }

    const field = page.locator('fk-site-footer input[type=email]');
    await field.fill('buyer@example.tn');
    await page.locator('fk-site-footer button[type=submit]').click();
    await page.waitForTimeout(1200);

    // `(ngSubmit)` was bound on a form with no NgForm attached, so the browser
    // performed its own GET and reloaded the page with ?email=… in the URL.
    expect(new URL(page.url()).search).toBe('');
    await expect(page.locator('fk-site-footer')).not.toContainText(/consultez votre boîte/i);
    await expect(field).toHaveValue('buyer@example.tn');
  });

  test('treats a non-JSON 200 as a failure', async ({ page }) => {
    await page.route('**/api/newsletter', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' }),
    );
    await page.goto('/fr');
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(100);
    }

    const field = page.locator('fk-site-footer input[type=email]');
    await field.fill('buyer@example.tn');
    await page.locator('fk-site-footer button[type=submit]').click();
    await page.waitForTimeout(800);

    await expect(page.locator('fk-site-footer')).not.toContainText(/consultez votre boîte/i);
    await expect(field).toHaveValue('buyer@example.tn');
  });
});
