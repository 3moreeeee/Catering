import { describe, expect, it } from 'vitest';
import { catalogueSize, searchProducts, searchTerms } from './assistant';

const page = (items: unknown[]) =>
  new Response(
    JSON.stringify({ items, total: items.length, page: 0, pageSize: 12, totalPages: 1 }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );

describe('assistant catalogue retrieval', () => {
  it('normalises French accents in search terms', () => {
    expect(searchTerms('cuillère')).toEqual(searchTerms('cuillere'));
    expect(searchTerms('Chope à bière polycarbonate')).toEqual(['chope', 'biere', 'polycarbonate']);
  });

  it('does not turn a generic catalogue question into a search', async () => {
    expect(searchTerms('Quels produits proposez-vous ?')).toEqual([]);
    let called = false;
    const results = await searchProducts('Quels produits proposez-vous ?', '/api', () => {
      called = true;
      return Promise.resolve(page([]));
    });
    expect(results).toEqual([]);
    expect(called).toBe(false);
  });

  it('asks the database for a small ranked page, any term matching', async () => {
    let requested = '';
    const results = await searchProducts(
      'polycarbonate beer mug',
      'https://site.test/api',
      (url) => {
        requested = url;
        return Promise.resolve(
          page([
            {
              slug: 'chope-polycarbonate',
              categoryId: 'packaging',
              name: { fr: 'Chope à bière en polycarbonate', en: 'Polycarbonate beer mug' },
              shortDescription: null,
              formats: [{ value: '500 ml' }],
              images: [{ src: '/img/products/vinto/74-chope.v2.webp' }],
            },
          ]),
        );
      },
    );
    const url = new URL(requested);
    expect(url.pathname).toBe('/api/products');
    expect(url.searchParams.get('match')).toBe('any');
    expect(url.searchParams.get('q')).toBe('polycarbonate beer mug');
    expect(Number(url.searchParams.get('pageSize'))).toBeLessThanOrEqual(12);
    expect(results[0]?.slug).toBe('chope-polycarbonate');
    // A catalogue key is served from ImageKit, like every product photograph.
    expect(results[0]?.image).toMatch(
      /^https:\/\/ik\.imagekit\.io\/.+\/img\/products\/vinto\/74-chope\.v2\.webp$/,
    );
  });

  it('answers without products or a count when the API is unreachable', async () => {
    const down = (): Promise<Response> => Promise.reject(new Error('offline'));
    expect(await searchProducts('polycarbonate beer mug', '/api', down)).toEqual([]);
    expect(await catalogueSize('/api', down)).toBeNull();
  });

  it('reads the catalogue size from the stats endpoint', async () => {
    const size = await catalogueSize('https://site.test/api', () =>
      Promise.resolve(
        new Response(JSON.stringify({ total: 293, categories: {}, brands: {} }), { status: 200 }),
      ),
    );
    expect(size).toBe(293);
  });
});
