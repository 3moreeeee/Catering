import { describe, expect, it } from 'vitest';
import { searchProducts } from './assistant';

describe('assistant catalogue retrieval', () => {
  it('finds an exact bilingual product query', () => {
    const results = searchProducts('polycarbonate gastronorm container');
    expect(results[0]?.slug).toBe(
      'vinto-bac-gastronorme-avec-couvercle-en-polycarbonate-gn-1-1-h-100mm-254',
    );
  });

  it('normalises French accents', () => {
    const accented = searchProducts('cuillère').map((product) => product.slug);
    const plain = searchProducts('cuillere').map((product) => product.slug);
    expect(accented).toEqual(plain);
    expect(accented.length).toBeGreaterThan(0);
  });

  it('does not turn a generic catalogue question into arbitrary product matches', () => {
    expect(searchProducts('Quels produits proposez-vous ?')).toEqual([]);
  });

  it('returns no products for an unrelated request', () => {
    expect(searchProducts('astronomy telescope')).toEqual([]);
  });
});
