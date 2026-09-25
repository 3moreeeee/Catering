import { describe, expect, it } from 'vitest';
import { CURATED_PRODUCTS, PRODUCTS } from './products.data';
import { IMPORTED_PRODUCTS } from './products.imported.data';
import { MONIN_PRODUCTS } from './products.monin.data';
import { BRANDS } from './brands.data';
import { CATEGORIES } from './categories.data';
import { INDUSTRY_IDS } from '../shared/models/catalog.model';

/**
 * Guards on the reconciled import.
 *
 * These are the rules the import script promises to keep, asserted against its
 * actual output rather than against its intentions. Several of them exist
 * because the pipeline broke them at least once during development: it read its
 * own output as an existing catalogue and deleted itself, and it attributed no
 * brand at all because it read a field the source never populates.
 */
describe('reconciled catalogue import', () => {
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));
  const familyIds = new Set(
    CATEGORIES.flatMap((c) => c.subcategories.map((s) => `${c.id}/${s.id}`)),
  );
  const brandIds = new Set(BRANDS.map((b) => b.id));
  const industryIds = new Set<string>(INDUSTRY_IDS);

  it('replaces all legacy core-division records and preserves MONIN', () => {
    expect(CURATED_PRODUCTS).toHaveLength(0);
    expect(IMPORTED_PRODUCTS).toHaveLength(190);
    expect(MONIN_PRODUCTS).toHaveLength(57);
    expect(PRODUCTS).toHaveLength(247);
    expect(
      PRODUCTS.every(
        (product) => product.id.startsWith('p-vinto-') || product.id.startsWith('p-monin-'),
      ),
    ).toBe(true);
  });

  it('matches the current unique Vinto counts for every replaced division', () => {
    expect(IMPORTED_PRODUCTS.filter((product) => product.categoryId === 'food')).toHaveLength(20);
    expect(IMPORTED_PRODUCTS.filter((product) => product.categoryId === 'packaging')).toHaveLength(
      145,
    );
    expect(IMPORTED_PRODUCTS.filter((product) => product.categoryId === 'hygiene')).toHaveLength(
      25,
    );
  });

  it('gives every product a unique id across both sets', () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every product a unique slug across both sets', () => {
    const slugs = PRODUCTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('never reuses a format reference', () => {
    const references = PRODUCTS.flatMap((p) =>
      p.formats.map((f) => f.reference).filter((r): r is string => Boolean(r)),
    );
    expect(new Set(references).size).toBe(references.length);
  });

  it('maps every imported record onto a category and family that exist', () => {
    for (const product of [...IMPORTED_PRODUCTS, ...MONIN_PRODUCTS]) {
      expect(categoryIds.has(product.categoryId), product.id).toBe(true);
      expect(product.subcategoryId, product.id).toBeTruthy();
      expect(familyIds.has(`${product.categoryId}/${product.subcategoryId}`), product.id).toBe(
        true,
      );
    }
  });

  it('references only industries that exist', () => {
    for (const product of IMPORTED_PRODUCTS) {
      expect(product.industries.length).toBeGreaterThan(0);
      for (const industry of product.industries) {
        expect(industryIds.has(industry), `${product.id} → ${industry}`).toBe(true);
      }
    }
  });

  it('attributes a brand only when that brand is a published partner', () => {
    for (const product of IMPORTED_PRODUCTS) {
      if (product.brandId) {
        expect(brandIds.has(product.brandId), `${product.id} → ${product.brandId}`).toBe(true);
      }
    }
  });

  it('never claims a partnership with a brand seen only on the source', () => {
    const unverified = ['lilas', 'lamaa'];
    const attributed = new Set(IMPORTED_PRODUCTS.map((p) => p.brandId).filter(Boolean));
    for (const brand of unverified) {
      expect(attributed.has(brand), `${brand} must not be attributed`).toBe(false);
    }
    for (const brand of attributed) {
      expect(brandIds.has(brand as string)).toBe(true);
    }
  });

  it('publishes no Delicio product or Delicio image', () => {
    expect(JSON.stringify(PRODUCTS)).not.toMatch(/delicio/i);
  });

  it('carries complete French and English copy on every field', () => {
    for (const product of IMPORTED_PRODUCTS) {
      for (const field of ['name', 'shortDescription', 'description'] as const) {
        expect(product[field].fr.trim().length, `${product.id}.${field}.fr`).toBeGreaterThan(2);
        expect(product[field].en.trim().length, `${product.id}.${field}.en`).toBeGreaterThan(2);
      }
      expect(product.seo.title.fr.length).toBeGreaterThan(2);
      expect(product.seo.title.en.length).toBeGreaterThan(2);
      expect(product.seo.description.fr.length).toBeGreaterThan(10);
      expect(product.seo.description.en.length).toBeGreaterThan(10);
    }
  });

  it('gives every image an alt text in both locales', () => {
    for (const product of IMPORTED_PRODUCTS) {
      expect(product.images.length, product.id).toBeGreaterThan(0);
      for (const image of product.images) {
        expect(image.src.startsWith('/img/'), `${product.id} image src`).toBe(true);
        expect(image.alt.fr.length).toBeGreaterThan(2);
        expect(image.alt.en.length).toBeGreaterThan(2);
        expect(image.width).toBeGreaterThan(0);
        expect(image.height).toBeGreaterThan(0);
      }
    }
  });

  it('serves every scraped photograph from the local application', () => {
    for (const product of PRODUCTS) {
      for (const image of product.images) {
        expect(image.src).not.toMatch(/^https?:/);
        expect(image.src).toMatch(/^\/img\/products\/(vinto|monin)\//);
        expect(image.src).toMatch(/\.v2\.webp$/);
      }
    }
  });

  // Prices are a published feature of the site, but they live in the backend
  // catalogue and are fetched at runtime. Baking them into this bundled snapshot
  // would freeze them at build time, so a price appearing here is a regression
  // even though prices themselves are no longer forbidden.
  it('keeps price, stock and offer data out of the bundled snapshot', () => {
    const serialized = JSON.stringify(IMPORTED_PRODUCTS);
    expect(serialized).not.toMatch(/"price"/i);
    expect(serialized).not.toMatch(/"quantity"\s*:/i);
    expect(serialized).not.toMatch(/"stock"/i);
    expect(serialized).not.toMatch(/\bTND\b|\bDT\b/);
    // A bare currency amount would be the giveaway.
    expect(serialized).not.toMatch(/\d+[.,]\d{2}\s?(€|\$)/);
  });

  it('leaks no unfinished marker into a published field', () => {
    const serialized = JSON.stringify(IMPORTED_PRODUCTS);
    for (const marker of ['NEEDS_', 'à confirmer', 'à fournir', 'TODO', 'Lorem']) {
      expect(serialized).not.toContain(marker);
    }
  });

  it('does not reuse the source’s own marketing sentences', () => {
    // Every description is composed from the division, family and format. The
    // giveaway for copied copy would be an ingredient list or a second-person
    // sales pitch, neither of which the generated pattern can produce.
    for (const product of IMPORTED_PRODUCTS) {
      expect(product.description.fr).toMatch(/fait partie du catalogue professionnel Vinto actuel/);
      expect(product.description.en).toMatch(/is part of the current Vinto professional catalogue/);
      expect(product.description.fr).not.toMatch(/ingr[ée]dient/i);
    }
  });
});
