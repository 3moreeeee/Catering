import { describe, expect, it } from 'vitest';
import { Product } from '../models/catalog.model';
import { buildProductFormatIndex, parsePhysicalFormat } from './product-format-engine';
import { PRODUCTS } from '../../data/products.data';
import { PRODUCT_IMAGE_OCCUPANCY } from '../../data/product-image-metrics.generated';

function product(
  id: string,
  name: string,
  format: string,
  categoryId: Product['categoryId'] = 'packaging',
): Product {
  return {
    id,
    slug: id,
    name: { fr: name, en: name },
    categoryId,
    shortDescription: { fr: '', en: '' },
    description: { fr: '', en: '' },
    industries: [],
    featured: false,
    formats: format ? [{ id: `${id}-f`, value: format }] : [],
    images: [
      { src: `/img/products/${id}.webp`, alt: { fr: name, en: name }, width: 800, height: 800 },
    ],
    seo: { title: { fr: name, en: name }, description: { fr: '', en: '' } },
  };
}

describe('physical product formats', () => {
  it.each([
    ['25cl', 'volume', 250],
    ['70 cl', 'volume', 700],
    ['1L', 'volume', 1000],
    ['1,89 L', 'volume', 1890],
    ['1.89 L', 'volume', 1890],
    ['220ml', 'volume', 220],
    ['400 ml', 'volume', 400],
    ['500ml', 'volume', 500],
    ['1000ml', 'volume', 1000],
    ['1100ml', 'volume', 1100],
    ['184 gr', 'weight', 184],
    ['425 GR', 'weight', 425],
    ['1.36 kg', 'weight', 1360],
    ['170x122x30mm', 'dimensions3d', 170 * 122 * 30],
    ['193 x 137 x 30 mm', 'dimensions3d', 193 * 137 * 30],
    ['224×142×30 mm', 'dimensions3d', 224 * 142 * 30],
    ['5.7 x 9 cm', 'dimensions2d', 57 * 90],
    ['7 x 12 cm', 'dimensions2d', 70 * 120],
    ['8 x 13.5 cm', 'dimensions2d', 80 * 135],
    ['9cm', 'length', 90],
    ['12cm', 'length', 120],
    ['15cm', 'length', 150],
    ['18cm', 'length', 180],
    ['250 mm x 1500 m', 'roll', 250],
  ] as const)('normalizes %s', (raw, kind, metric) => {
    expect(parsePhysicalFormat(raw, kind === 'roll' ? 'Film étirable' : '').kind).toBe(kind);
    expect(parsePhysicalFormat(raw, kind === 'roll' ? 'Film étirable' : '').metric).toBe(metric);
  });

  it('uses diameter and wearer-fit semantics', () => {
    expect(parsePhysicalFormat('DIAM 114MM', 'Papier dentelle rond').kind).toBe('diameter');
    expect(parsePhysicalFormat('DIAM 360MM', 'Papier dentelle rond').metric).toBe(360);
    expect(parsePhysicalFormat('S / M / L', 'Gants').kind).toBe('fit');
    expect(parsePhysicalFormat('L / XL', 'Surchaussure').kind).toBe('fit');
    expect(parsePhysicalFormat('100 / 500', 'Couvercle PET').metric).toBeNull();
    expect(parsePhysicalFormat('Pack de 250 pièces').metric).toBeNull();
  });

  it('ranks only matching product families, with equal visible size for equal flavor formats', () => {
    const products = [
      product('a', 'Sirop grenadine MONIN 25cl', '25 cl', 'monin'),
      product('b', 'Sirop mangue MONIN 70cl', '70 cl', 'monin'),
      product('c', 'Sirop vanille MONIN 70cl', '70 cl', 'monin'),
      product('d', 'Sirop pomme MONIN 1L', '1 L', 'monin'),
      product('e', 'Barquette pour fritures 220 ml en kraft', '220 ml'),
      product('f', 'Barquette pour fritures 400 ml en kraft', '400 ml'),
      product('g', 'Pot à sauce 30 ml', '30 ml'),
      product('h', 'Pot à sauce 60 ml', '60 ml'),
    ];
    const { visuals, rows } = buildProductFormatIndex(products);
    expect(
      rows.filter((row) => row.familyKey === 'monin.syrup').map((row) => row.sizeRank),
    ).toEqual([1, 2, 2, 3]);
    expect(visuals.get('b')?.imageScale).toBe(visuals.get('c')?.imageScale);
    expect(visuals.get('a')?.imageScale).toBeLessThan(visuals.get('b')!.imageScale);
    expect(visuals.get('b')?.imageScale).toBeLessThan(visuals.get('d')!.imageScale);
    expect(rows.find((row) => row.productId === 'e')?.familyKey).not.toBe(
      rows.find((row) => row.productId === 'g')?.familyKey,
    );
    expect(visuals.get('e')?.qualifier).toBe('small');
    expect(visuals.get('f')?.qualifier).toBe('large');
  });

  it('uses full sushi dimensions, and leaves PDF conflicts unranked', () => {
    const { rows, visuals } = buildProductFormatIndex([
      product('small', 'Barquette à sushi 170x122x30mm', '30 mm'),
      product('middle', 'Barquette à sushi 193x137x30mm', '30 mm'),
      product('large', 'Barquette à sushi 224x142x30mm', '30 mm'),
      product('conflict', 'Bol à soupe blanc 1000ml', '1000 ml'),
      product('confirmed', 'Bol à soupe blanc 500ml', '500 ml'),
    ]);
    expect(rows.slice(0, 3).map((row) => row.sizeRank)).toEqual([1, 2, 3]);
    expect(visuals.get('middle')?.value).toContain('193x137x30mm');
    expect(rows.find((row) => row.productId === 'conflict')?.warning).toContain('not listed');
    expect(visuals.get('conflict')?.qualifier).toBe('plain');
  });

  it('audits every bundled product and ranks the reconciled supplier formats', () => {
    const { rows, visuals } = buildProductFormatIndex(PRODUCTS, PRODUCT_IMAGE_OCCUPANCY);
    expect(rows).toHaveLength(PRODUCTS.length);
    expect(new Set(rows.map((row) => row.productId)).size).toBe(PRODUCTS.length);
    // These four disagreed with the supplier lists until the reconciliation;
    // the 800 g sweetcorn was withdrawn, the other three were corrected.
    expect(rows.find((row) => row.productId === 'p-vinto-488')).toBeUndefined();
    for (const [id, qualifier] of [
      ['p-vinto-373', 'large'],
      ['p-vinto-120', 'small'],
      ['p-vinto-122', 'standard'],
    ]) {
      expect(rows.find((row) => row.productId === id)?.warning).toBeNull();
      expect(visuals.get(id!)?.qualifier).toBe(qualifier);
    }
    expect(
      rows.filter((row) => row.warning).map((row) => `${row.productId}: ${row.warning}`),
    ).toEqual([]);
    expect(rows.filter((row) => row.familyCount > 1 && !row.warning).length).toBeGreaterThan(100);
    for (const row of rows.filter((entry) => entry.familyKey === 'packaging.pet-cup')) {
      expect(visuals.get(row.productId)?.imageScale).toBe(1);
      expect(row.sizeRank).not.toBeNull();
    }
  });

  it('uses the same measured canvas for the live API filename encoding', () => {
    const bundled = PRODUCTS.find((item) => item.id === 'p-monin-425')!;
    const live = {
      ...bundled,
      images: bundled.images.map((image) => ({
        ...image,
        src: image.src.replace('%C3%A9', '_C3_A9'),
      })),
    };
    const withBundledAsset = buildProductFormatIndex(PRODUCTS, PRODUCT_IMAGE_OCCUPANCY).visuals.get(
      bundled.id,
    );
    const withLiveAsset = buildProductFormatIndex(
      PRODUCTS.map((item) => (item.id === live.id ? live : item)),
      PRODUCT_IMAGE_OCCUPANCY,
    ).visuals.get(live.id);
    expect(withLiveAsset?.imageScale).toBe(withBundledAsset?.imageScale);
  });
});
