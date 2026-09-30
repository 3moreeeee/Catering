import { describe, expect, it } from 'vitest';
import { Product } from '../models/catalog.model';
import { parseProductFormat, productFormatVisual } from './product-format';

function product(
  name: string,
  format: string,
  categoryId: Product['categoryId'],
  subcategoryId: string,
): Product {
  return {
    id: name,
    slug: name,
    name: { fr: name, en: name },
    shortDescription: { fr: '', en: '' },
    description: { fr: '', en: '' },
    categoryId,
    subcategoryId,
    industries: [],
    formats: format ? [{ id: 'format', value: format }] : [],
    images: [],
    featured: false,
    seo: { title: { fr: '', en: '' }, description: { fr: '', en: '' } },
  };
}

describe('product format', () => {
  it.each([
    ['25 cl', 250],
    ['70cl', 700],
    ['70 cl', 700],
    ['1 L', 1000],
    ['1,89 L', 1890],
    ['1.89 L', 1890],
    ['220ml', 220],
    ['400 ml', 400],
  ])('parses volume %s', (input, ml) => {
    expect(parseProductFormat(input)).toMatchObject({ kind: 'volume', ml });
  });

  it.each([
    ['170x122x30mm', 170, 122],
    ['193×137×30 mm', 193, 137],
  ])('parses dimensions %s', (input, width, depth) => {
    expect(parseProductFormat(input)).toMatchObject({
      kind: 'dimensions',
      width,
      depth,
      height: 30,
    });
  });

  it('uses distinct MONIN bottle sizes', () => {
    const sizes = ['25 cl', '70 cl', '1 L', '1.89 L'].map(
      (format) =>
        productFormatVisual(product(`Sirop MONIN ${format}`, format, 'monin', 'syrups'))?.size,
    );
    expect(sizes).toEqual(['xs', 'md', 'lg', 'xl']);
  });

  it('compares only related packaging and reads sushi dimensions from the title', () => {
    expect(
      productFormatVisual(
        product('Barquette pour fritures 220 ml', '220 ml', 'packaging', 'trays-containers'),
      )?.size,
    ).toBe('sm');
    expect(
      productFormatVisual(
        product('Barquette pour fritures 400 ml', '400 ml', 'packaging', 'trays-containers'),
      )?.size,
    ).toBe('lg');
    expect(
      productFormatVisual(
        product('Barquette à sushi 170x122x30mm', '30 mm', 'packaging', 'trays-containers'),
      )?.size,
    ).toBe('sm');
    expect(
      productFormatVisual(
        product('Barquette à sushi 193×137×30 mm', '30 mm', 'packaging', 'trays-containers'),
      )?.size,
    ).toBe('lg');
    expect(
      productFormatVisual(product('Gobelet 400 ml', '400 ml', 'packaging', 'glassware'))?.size,
    ).toBe('md');
  });

  it('falls back safely for products without physical size', () => {
    expect(parseProductFormat('Pack de 100 pièces')).toBeNull();
    expect(productFormatVisual(product('Rack MONIN', '', 'monin', 'bar-tools'))).toBeNull();
  });
});
