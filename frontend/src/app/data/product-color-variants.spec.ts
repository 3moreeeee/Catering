import { describe, expect, it } from 'vitest';
import { PRODUCTS } from './products.data';
import { groupColorVariants } from './product-color-variants';
import { InMemoryProductRepository } from './repositories/in-memory-product.repository';

describe('supplier colour variants', () => {
  it('shows each colour line once and retains every purchasable SKU', () => {
    const catalog = groupColorVariants(PRODUCTS);
    expect(catalog).toHaveLength(PRODUCTS.length - 2);

    const drop = catalog.filter((product) => ['p-vinto-348', 'p-vinto-183'].includes(product.id));
    expect(drop).toHaveLength(1);
    expect(drop[0]?.id).toBe('p-vinto-348');
    expect(drop[0]?.name.fr).toBe('Verrine goutte 11ml transparente / noire- LES 50 PIÈCES');
    expect(drop[0]?.colorVariants?.map((variant) => [variant.id, variant.label.fr])).toEqual([
      ['p-vinto-348', 'Transparente'],
      ['p-vinto-183', 'Noire'],
    ]);

    const cap = catalog.filter((product) => ['p-vinto-151', 'p-vinto-349'].includes(product.id));
    expect(cap).toHaveLength(1);
    expect(cap[0]?.name.fr).toBe('Calot rayé rouge-bleu en papier- LES 100 PIÈCES');
    expect(cap[0]?.colorVariants?.map((variant) => variant.id)).toEqual([
      'p-vinto-151',
      'p-vinto-349',
    ]);
  });

  it('resolves an old colour-specific link to the one product page', () => {
    const repository = new InMemoryProductRepository(groupColorVariants(PRODUCTS));
    const oldBlack = PRODUCTS.find((product) => product.id === 'p-vinto-183')!;
    let resolvedId: string | undefined;
    repository.bySlug('packaging', oldBlack.slug).subscribe((product) => {
      resolvedId = product?.id;
    });
    expect(resolvedId).toBe('p-vinto-348');
  });
});
