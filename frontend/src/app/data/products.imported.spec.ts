import { describe, expect, it } from 'vitest';
import { CURATED_PRODUCTS, PRODUCTS, SALE_TERMS } from './products.data';
import { UNPRICED_BY_SUPPLIER } from './supplier-price-lists.data';
import { CATALOG_IMAGES } from './catalog-images.data';
import { IMPORTED_PRODUCTS } from './products.imported.data';
import { MONIN_PRODUCTS } from './products.monin.data';
import { BRANDS } from './brands.data';
import { CATEGORIES } from './categories.data';
import { INDUSTRY_IDS } from '../shared/models/catalog.model';
import {
  CATALOG_ADDITIONS,
  CATALOG_CORRECTIONS,
  CATALOG_REMOVALS,
} from './catalog-reconciliation.data';

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
    expect(
      PRODUCTS.every(
        (product) =>
          product.id.startsWith('p-vinto-') ||
          product.id.startsWith('p-monin-') ||
          product.id.startsWith('p-fk-'),
      ),
    ).toBe(true);
  });

  it('applies the supplier price-list reconciliation to the feeds', () => {
    // 247 feed records, 23 withdrawn, 71 supplier lines added.
    expect(CATALOG_REMOVALS).toHaveLength(23);
    expect(CATALOG_ADDITIONS).toHaveLength(71);
    expect(PRODUCTS).toHaveLength(247 - 23 + 71);

    const ids = new Set(PRODUCTS.map((product) => product.id));
    for (const removal of CATALOG_REMOVALS) expect(ids.has(removal.id)).toBe(false);
    for (const addition of CATALOG_ADDITIONS) expect(ids.has(addition.id)).toBe(true);
    for (const correction of CATALOG_CORRECTIONS) {
      expect(PRODUCTS.find((product) => product.id === correction.id)?.name).toEqual(
        correction.name,
      );
    }
    // A withdrawn record must never be the target of a correction or merge.
    for (const removal of CATALOG_REMOVALS) {
      expect(CATALOG_CORRECTIONS.some((correction) => correction.id === removal.id)).toBe(false);
      if (removal.mergedInto) expect(ids.has(removal.mergedInto)).toBe(true);
    }
  });

  it('prices every product from its supplier line, except the ones the lists cannot price', () => {
    const unpricedIds = Object.keys(UNPRICED_BY_SUPPLIER);
    for (const product of PRODUCTS) {
      if (unpricedIds.includes(product.id)) continue;
      expect(SALE_TERMS.has(product.id), product.id).toBe(true);
    }
    const terms = (id: string) => SALE_TERMS.get(id)!;
    // Hygiène: 0,120 HT the piece, colisage 100.
    expect(terms('p-fk-bonnet-de-douche')).toMatchObject({
      saleMode: 'PACK_ONLY',
      unitMillimes: 120,
      packQuantity: 100,
      priceMillimes: 12000,
    });
    // MONIN: 27,406 HT the bottle, sold by the carton of 6.
    expect(terms('p-monin-320')).toMatchObject({
      unitMillimes: 27406,
      packQuantity: 6,
      priceMillimes: 164436,
      unit: 'bouteille',
    });
    // A lot price (17,000 the 1000) on a product the site sells by 250.
    expect(terms('p-vinto-109')).toMatchObject({
      unitMillimes: 17,
      packQuantity: 250,
      priceMillimes: 4250,
      supplierColisage: 1000,
    });
    // Cup + lid, both from the Gobelets list.
    expect(terms('p-vinto-48')).toMatchObject({
      unitMillimes: 290,
      packQuantity: 50,
      priceMillimes: 14500,
    });
    // A lot price that does not divide exactly is sold as that lot, undivided.
    expect(terms('p-fk-paille-papier-230x8')).toMatchObject({
      saleMode: 'UNIT',
      unitMillimes: null,
      packQuantity: 1050,
      priceMillimes: 57700,
    });
    // "Rupture provisoire": no price is invented.
    expect(terms('p-fk-combinaison')).toMatchObject({ status: 'UNAVAILABLE', priceMillimes: null });
    // Every pack price is exactly its unit price × its lot.
    for (const [id, value] of SALE_TERMS) {
      if (value.saleMode === 'PACK_ONLY')
        expect(value.priceMillimes, id).toBe(value.unitMillimes! * value.packQuantity!);
    }
  });

  it('gives a new product only the photographs matched to it, and keeps the lot on the primary format', () => {
    for (const addition of CATALOG_ADDITIONS) {
      const product = PRODUCTS.find((entry) => entry.id === addition.id)!;
      const match = CATALOG_IMAGES[addition.id];
      expect(product.images.length, addition.id).toBe(
        match?.hosted?.length || match?.sources.length || 0,
      );
      if (match?.hosted?.length) expect(product.images[0]!.src).toBe(match.hosted[0]!.src);
      else if (match)
        expect(product.images[0]!.src).toBe(`/img/products/catalogue/${match.file}.v2.webp`);
    }
    // A photograph the owner uploaded is kept as is.
    expect(
      PRODUCTS.find((entry) => entry.id === 'p-fk-monin-cookies-70cl')!.images[0]!.src,
    ).toContain('/img/products/admin/');
    // A format never borrows another format's photograph.
    expect(
      PRODUCTS.find((entry) => entry.id === 'p-fk-monin-caramel-1l')!.images[0]!.src,
    ).toContain('monin-sirop-caramel-1l');
    const grenadine = PRODUCTS.find((product) => product.id === 'p-monin-320')!;
    expect(grenadine.formats[0]).toMatchObject({ value: '70 cl', packQuantity: 6 });
  });

  it('keeps the supplier size families the price lists publish', () => {
    const formatsOf = (pattern: RegExp) =>
      PRODUCTS.filter((product) => pattern.test(product.name.fr))
        .map((product) => product.formats[0]?.value)
        .sort();
    expect(formatsOf(/^Champignons en tranches Emporium/)).toEqual(['184 g', '425 g', '850 g']);
    expect(formatsOf(/^Ma[iïÏ]s doux Emporium/i)).toEqual(['184 g', '3100 ml', '425 g']);
    expect(formatsOf(/^Haricots? rouges?/)).toEqual(['184 g', '400 g']);
    expect(formatsOf(/^Moutarde forte de Dijon/)).toEqual(['200 g', '370 g', '850 g']);
    expect(formatsOf(/^Bol à soupe .*carton blanc/)).toEqual(['1100 ml', '500 ml']);
    expect(formatsOf(/^Bol à soupe .*kraft/)).toEqual(['1000 ml', '500 ml']);
    expect(
      PRODUCTS.filter((product) => /^Bateau ovale/.test(product.name.fr))
        .map((product) => product.name.fr)
        .sort(),
    ).toEqual([
      'Bateau ovale 5.7cm x 9cm',
      'Bateau ovale 7cm x 12cm- LES 100 PIÈCES',
      'Bateau ovale 8cm x 13.5cm- LES 100 PIÈCES',
    ]);
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
      // Photographs the owner uploaded through the admin already live on ImageKit.
      const hosted = CATALOG_IMAGES[product.id]?.hosted;
      if (hosted?.length) {
        expect(product.images.map((image) => image.src)).toEqual(hosted.map((image) => image.src));
        expect(hosted.every((image) => image.src.startsWith('https://ik.imagekit.io/'))).toBe(true);
        continue;
      }
      for (const image of product.images) {
        expect(image.src).not.toMatch(/^https?:/);
        expect(image.src).toMatch(/^\/img\/products\/(vinto|monin|catalogue)\//);
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
