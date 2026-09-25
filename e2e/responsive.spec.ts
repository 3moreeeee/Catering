import { expect, test, type Page } from '@playwright/test';

/**
 * Layout guarantees at every width the site is designed for.
 *
 * These tests exist because "the page does not scroll sideways" turned out to
 * be worthless on its own. The homepage passed that check while the hero's
 * headline, lead and primary call to action all hung 53px off the side of a
 * 320px screen, and the enquiry button on a product card hung 45px off a 360px
 * one — invisible, because an ancestor's `overflow` swallowed them. So the
 * assertions below measure **bounding boxes**: every heading, paragraph and
 * control has to physically sit inside the viewport, with its complete label.
 */

const WIDTHS = [320, 360, 390, 768, 1024, 1440, 1920] as const;
const LOCALES = ['fr', 'en'] as const;

/** Resolves every `@defer (on viewport)` block so nothing is measured unbuilt. */
async function settle(page: Page, viewportHeight: number): Promise<void> {
  let previous = -1;
  for (let i = 0; i < 40; i++) {
    await page.evaluate((step) => window.scrollBy(0, step), viewportHeight * 0.8);
    await page.waitForTimeout(120);
    const y = await page.evaluate(() => window.scrollY);
    if (y === previous) break;
    previous = y;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

/**
 * Anything that carries words or accepts a click, and sits outside the
 * viewport. Media is excused when a frame is deliberately cropping it — the
 * division stills are scaled up inside `overflow: clip` on purpose — but text
 * and controls never are, because that allowance is exactly how the original
 * defects stayed invisible.
 */
async function elementsOutsideViewport(page: Page, width: number) {
  return page.evaluate((vw) => {
    const MEDIA = new Set(['img', 'video', 'picture', 'svg', 'canvas']);
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      return (
        !el.classList.contains('u-visually-hidden') &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        (el as HTMLElement).offsetParent !== null
      );
    };
    const excused = (el: Element) => {
      if (!MEDIA.has(el.tagName.toLowerCase())) return false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const overflow = getComputedStyle(p).overflowX;
        if (['clip', 'hidden', 'auto', 'scroll'].includes(overflow)) {
          const box = p.getBoundingClientRect();
          return box.left >= -1 && box.right <= vw + 1;
        }
      }
      return false;
    };

    const offenders: string[] = [];
    for (const el of document.querySelectorAll(
      'a, button, h1, h2, h3, p, li, input, select, img, span',
    )) {
      if (!visible(el) || excused(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue;
      if (box.left < -1 || box.right > vw + 1) {
        offenders.push(
          `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ` +
            `[${Math.round(box.left)}…${Math.round(box.right)}] ` +
            `"${(el.textContent || '').trim().slice(0, 40)}"`,
        );
      }
    }
    return offenders;
  }, width);
}

/** Text that its own box is hiding — a clamp or an overflow actually cutting it. */
async function clippedText(page: Page) {
  return page.evaluate(() => {
    const offenders: string[] = [];
    for (const el of document.querySelectorAll('a, button, h1, h2, h3, h4, p, span, li, dt, dd')) {
      if (el.children.length > 0) continue;
      // Visually-hidden text is not clipped content: it is deliberately taken
      // out of the visual flow and left for assistive technology. Detect it by
      // its shape rather than by one class name, because the pattern is applied
      // through a mixin in several places under different selectors.
      const box = el.getBoundingClientRect();
      const hidden =
        el.classList.contains('u-visually-hidden') ||
        (box.width <= 1 && box.height <= 1) ||
        getComputedStyle(el).clipPath === 'inset(50%)';
      if (hidden) continue;
      const style = getComputedStyle(el);
      if ((el as HTMLElement).offsetParent === null) continue;
      const hides = (v: string) => v === 'hidden' || v === 'clip' || v === 'auto' || v === 'scroll';
      if (!hides(style.overflowX) && !hides(style.overflowY) && style.webkitLineClamp === 'none') {
        continue;
      }
      const cut =
        el.scrollWidth - el.clientWidth > 2 || el.scrollHeight - el.clientHeight > 4;
      if (cut) {
        offenders.push(
          `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ` +
            `"${(el.textContent || '').trim().slice(0, 40)}"`,
        );
      }
    }
    return offenders;
  });
}

for (const locale of LOCALES) {
  test.describe(`homepage layout — ${locale}`, () => {
    for (const width of WIDTHS) {
      test(`nothing leaves the viewport at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}`);
        await settle(page, 900);

        expect(await elementsOutsideViewport(page, width)).toEqual([]);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });

      test(`no text is cut off at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}`);
        await settle(page, 900);
        expect(await clippedText(page)).toEqual([]);
      });
    }

    test('the primary call to action keeps its whole label on a phone', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(`/${locale}`);

      const cta = page.locator('.hero__actions .btn--primary');
      await expect(cta).toBeVisible();

      const box = (await cta.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(321);

      // The label is not shortened, and it is not clipped: the element is at
      // least as tall as the text inside it.
      const cut = await cta.evaluate((el) => el.scrollWidth - el.clientWidth > 2);
      expect(cut).toBe(false);
      expect((await cta.innerText()).trim().length).toBeGreaterThan(10);
    });

    test('every product card enquiry button fits and reads in full', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale}`);
      await settle(page, 844);

      const actions = page.locator('fk-product-card .card__action');
      const count = await actions.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const action = actions.nth(i);
        if (!(await action.isVisible())) continue;
        const box = (await action.boundingBox())!;
        expect(box.x + box.width, `card action ${i} runs past the right edge`).toBeLessThanOrEqual(
          391,
        );
        expect(box.x).toBeGreaterThanOrEqual(-1);
        // WCAG 2.2 target size.
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    });
  });
}

test.describe('header', () => {
  for (const width of WIDTHS) {
    test(`fits and stays legible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/fr');
      await page.waitForTimeout(300);

      const inside = await page.evaluate((vw) => {
        const controls = [
          ...document.querySelectorAll('.header__inner a, .header__inner button, .header__inner input'),
        ].filter((el) => (el as HTMLElement).offsetParent !== null);
        return controls
          .map((el) => {
            const b = el.getBoundingClientRect();
            return { cls: (el.className || '').toString().split(' ')[0], right: b.right, left: b.left };
          })
          .filter((c) => c.right > vw + 1 || c.left < -1);
      }, width);
      expect(inside).toEqual([]);

      // The logo is a link and must remain a usable target, not squeezed to a
      // sliver by whatever else wants the room.
      const logo = (await page.locator('.header__logo').boundingBox())!;
      expect(logo.width).toBeGreaterThanOrEqual(100);
    });
  }

  test('the wordmark and the burger are legible over the dark hero', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fr');
    await page.waitForTimeout(300);

    // The supplied logo's wordmark is dark grey; over the hero the ivory
    // variant is the one shown.
    const shown = await page.evaluate(() => {
      const marks = [...document.querySelectorAll<HTMLImageElement>('.header__logo-mark')];
      return marks
        .filter((m) => Number(getComputedStyle(m).opacity) > 0.5)
        .map((m) => m.getAttribute('src'));
    });
    expect(shown).toEqual(['/img/logo-on-dark.png']);

    // The burger was being drawn in near-black on the near-black hero.
    const bars = await page.evaluate(
      () => getComputedStyle(document.querySelector('.header__burger-lines span')!).backgroundColor,
    );
    expect(bars).toBe('rgb(255, 250, 242)');

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(400);
    const afterScroll = await page.evaluate(() => {
      const marks = [...document.querySelectorAll<HTMLImageElement>('.header__logo-mark')];
      return marks
        .filter((m) => Number(getComputedStyle(m).opacity) > 0.5)
        .map((m) => m.getAttribute('src'));
    });
    expect(afterScroll).toEqual(['/img/logo-on-light.png']);
  });
});

test.describe('mobile navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fr');
  });

  test('opens, traps focus, and locks the page behind it', async ({ page }) => {
    await page.locator('.header__burger').click();
    await expect(page.locator('.mnav__panel')).toBeVisible();

    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('.mnav__panel')),
    ).toBe(true);
  });

  test('Escape closes it and returns focus to the burger', async ({ page }) => {
    await page.locator('.header__burger').click();
    await expect(page.locator('.mnav__panel')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.mnav__panel')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.activeElement?.classList.contains('header__burger')),
    ).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });

  test('the close button closes it', async ({ page }) => {
    await page.locator('.header__burger').click();
    await page.locator('.mnav__head button').click();
    await expect(page.locator('.mnav__panel')).toHaveCount(0);
  });

  test('navigating closes it and gives the page back', async ({ page }) => {
    await page.locator('.header__burger').click();
    await page.locator('.mnav__link').first().click();
    await expect(page.locator('.mnav__panel')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });

  test('the backdrop closes it at tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1024 });
    await page.goto('/fr');
    await page.locator('.header__burger').click();
    await expect(page.locator('.mnav__panel')).toBeVisible();

    await page.locator('.mnav__backdrop').click({ position: { x: 20, y: 400 } });
    await expect(page.locator('.mnav__panel')).toHaveCount(0);
  });
});

test.describe('third parties and dead controls', () => {
  test('Google Maps is not contacted until the visitor asks for it', async ({ page }) => {
    const google: string[] = [];
    page.on('request', (r) => {
      if (/google\.com|gstatic|googleapis/.test(r.url())) google.push(r.url());
    });

    await page.goto('/fr/contact');
    await settle(page, 900);
    expect(google, 'no third-party request before consent').toEqual([]);

    // The address and the escape hatch never depended on the embed.
    await expect(page.locator('.map-card__address')).toContainText("M'nihla");
    await expect(page.locator('.map-card__foot a')).toHaveAttribute('href', /google\.com\/maps/);

    await page.locator('.map-card__load').click();
    await expect(page.locator('.map-card__frame iframe')).toHaveCount(1);
  });

  test('no control on the catalogue does nothing when pressed', async ({ page }) => {
    await page.goto('/fr/products');
    // "Aperçu rapide" emitted an event that nothing in the application listened
    // for. It is gone rather than left looking operable.
    await expect(page.getByRole('button', { name: /Aperçu rapide/i })).toHaveCount(0);
  });
});

test.describe('unfinished content never reaches a visitor', () => {
  const ROUTES = ['', '/about', '/products', '/brands', '/industries', '/contact', '/privacy', '/terms'];
  const MARKERS = [
    'NEEDS_',
    'à confirmer',
    'à fournir',
    'à renseigner',
    'to be confirmed',
    'to be supplied',
    'to be provided',
    'TODO',
    'Lorem',
  ];

  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      test(`${locale}${route || '/'} publishes no placeholder text`, async ({ page }) => {
        await page.goto(`/${locale}${route}`);
        await settle(page, 900);
        const body = await page.evaluate(() => document.body.innerText);
        for (const marker of MARKERS) {
          expect(body, `"${marker}" is visible on ${locale}${route}`).not.toContain(marker);
        }
      });
    }
  }
});
