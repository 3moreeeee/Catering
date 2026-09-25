import { describe, expect, it, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { InMemoryProductRepository, normalize } from './in-memory.repository';
import { PRODUCTS } from '../products.data';
import { CATEGORIES } from '../categories.data';

describe('InMemoryProductRepository', () => {
  let repo: InMemoryProductRepository;

  beforeEach(() => {
    repo = new InMemoryProductRepository();
  });

  describe('catalogue integrity', () => {
    it('holds the curated gallery plus the reconciled import', async () => {
      const all = await firstValueFrom(repo.all());
      // Current Vinto references plus the dedicated MONIN catalogue.
      // reconciled against the public vinto.tn listing. The exact total moves
      // when the import is regenerated, so the assertion is on the floor rather
      // than on a number that would have to be edited every time.
      expect(all.length).toBeGreaterThanOrEqual(150);
      expect(all).toEqual(PRODUCTS);
      expect(all.filter((p) => p.categoryId === 'monin')).toHaveLength(57);
    });

    it('gives every product a unique slug, so no detail route collides', () => {
      const slugs = PRODUCTS.map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('gives every product both locales for name and description', () => {
      for (const product of PRODUCTS) {
        expect(product.name.en.length, `${product.id} en name`).toBeGreaterThan(0);
        expect(product.name.fr.length, `${product.id} fr name`).toBeGreaterThan(0);
        expect(product.shortDescription.en.length).toBeGreaterThan(0);
        expect(product.shortDescription.fr.length).toBeGreaterThan(0);
      }
    });

    it('gives every product image real alt text, never the legacy "Hello World"', () => {
      for (const product of PRODUCTS) {
        for (const image of product.images) {
          expect(image.alt.en).not.toBe('Hello World');
          expect(image.alt.fr).not.toBe('Hello World');
          expect(image.alt.en.length).toBeGreaterThan(3);
        }
      }
    });

    // The catalogue API is the source of truth for prices; this snapshot serves
    // search, faceting and prerendering. A price here would be a build-time copy
    // that silently goes stale.
    it('never carries a price field — prices come from the catalogue API', () => {
      const serialised = JSON.stringify(PRODUCTS);
      expect(serialised).not.toMatch(/"price"|"offers"|"currency"/i);
    });

    it('assigns every product to a published commercial universe', () => {
      const ids = new Set(CATEGORIES.map((c) => c.id));
      for (const product of PRODUCTS) {
        expect(ids.has(product.categoryId), product.id).toBe(true);
      }
    });

    it('points every subcategoryId at a subcategory of its own category', () => {
      for (const product of PRODUCTS) {
        if (!product.subcategoryId) continue;
        const category = CATEGORIES.find((c) => c.id === product.categoryId);
        const match = category?.subcategories.some((s) => s.id === product.subcategoryId);
        expect(match, `${product.id} → ${product.subcategoryId}`).toBe(true);
      }
    });
  });

  describe('search', () => {
    it('matches accent-insensitively, so "cafe" finds "café"', () => {
      expect(normalize('Café Senso')).toBe('cafe senso');
    });

    it('finds products by name', async () => {
      const page = await firstValueFrom(repo.list({ q: 'mayonnaise' }));
      expect(page.total).toBeGreaterThan(0);
      for (const product of page.items) {
        const haystack = normalize(`${product.name.en} ${product.name.fr}`);
        expect(haystack).toContain('mayonnaise');
      }
    });

    it('requires every term to match (AND, not OR)', async () => {
      const single = await firstValueFrom(repo.list({ q: 'verrine' }));
      const both = await firstValueFrom(repo.list({ q: 'verrine cube' }));
      expect(both.total).toBeLessThan(single.total);
      expect(both.total).toBeGreaterThan(0);
    });

    it('returns an empty page rather than throwing for nonsense input', async () => {
      const page = await firstValueFrom(repo.list({ q: 'zzzzqqqq' }));
      expect(page.total).toBe(0);
      expect(page.items).toEqual([]);
    });
  });

  describe('filtering', () => {
    it('filters by category', async () => {
      const page = await firstValueFrom(repo.list({ categories: ['hygiene'], pageSize: 500 }));
      expect(page.total).toBe(PRODUCTS.filter((p) => p.categoryId === 'hygiene').length);
      expect(page.total).toBeGreaterThan(0);
      expect(page.items.every((p) => p.categoryId === 'hygiene')).toBe(true);
    });

    it('combines filters conjunctively', async () => {
      const page = await firstValueFrom(
        repo.list({ categories: ['packaging'], subcategories: ['verrines'], pageSize: 500 }),
      );
      expect(page.total).toBeGreaterThan(0);
      expect(
        page.items.every((p) => p.categoryId === 'packaging' && p.subcategoryId === 'verrines'),
      ).toBe(true);
    });

    it('matches a product if ANY of its industries is selected', async () => {
      const page = await firstValueFrom(
        repo.list({ industries: ['pharmaceutical'], pageSize: 500 }),
      );
      expect(page.total).toBeGreaterThan(0);
      expect(page.items.every((p) => p.industries.includes('pharmaceutical'))).toBe(true);
    });
  });

  describe('pagination', () => {
    it('clamps a page number beyond the end rather than returning nothing', async () => {
      const page = await firstValueFrom(repo.list({ page: 9999 }));
      expect(page.page).toBe(page.totalPages);
      expect(page.items.length).toBeGreaterThan(0);
    });

    it('clamps a page number below one', async () => {
      const page = await firstValueFrom(repo.list({ page: -5 }));
      expect(page.page).toBe(1);
    });

    it('covers every product exactly once across all pages', async () => {
      const first = await firstValueFrom(repo.list({ page: 1 }));
      const seen = new Set<string>();
      for (let p = 1; p <= first.totalPages; p++) {
        const page = await firstValueFrom(repo.list({ page: p }));
        for (const item of page.items) {
          expect(seen.has(item.id), `duplicate ${item.id}`).toBe(false);
          seen.add(item.id);
        }
      }
      expect(seen.size).toBe(PRODUCTS.length);
    });
  });

  describe('sorting', () => {
    it('sorts by name ascending', async () => {
      const page = await firstValueFrom(repo.list({ sort: 'name-asc', pageSize: 500 }));
      const names = page.items.map((p) => p.name.en);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    });

    it('puts featured products first when no search term is given', async () => {
      const page = await firstValueFrom(repo.list({ sort: 'relevance' }));
      const firstItem = page.items[0];
      expect(firstItem?.featured).toBe(true);
    });
  });

  describe('facets', () => {
    it('counts a facet against the query with its OWN filter removed', async () => {
      // Selecting one division must not zero out the other divisions' counts,
      // or the user can never switch division without clearing filters first.
      const facets = await firstValueFrom(repo.facets({ categories: ['food'] }));
      expect(facets.categories.length).toBe(CATEGORIES.length);
      expect(facets.categories.every((f) => f.count > 0)).toBe(true);
    });

    it('narrows other facets by the active filter', async () => {
      const unfiltered = await firstValueFrom(repo.facets({}));
      const filtered = await firstValueFrom(repo.facets({ categories: ['hygiene'] }));
      expect(filtered.subcategories.length).toBeLessThan(unfiltered.subcategories.length);
    });
  });

  describe('related products', () => {
    it('never returns the product itself', async () => {
      const product = PRODUCTS[0]!;
      const related = await firstValueFrom(repo.related(product, 4));
      expect(related.some((p) => p.id === product.id)).toBe(false);
    });

    it('finds neighbours for every product, even singleton subcategories', async () => {
      for (const product of PRODUCTS) {
        const related = await firstValueFrom(repo.related(product, 4));
        expect(related.length, `${product.id} has no related products`).toBeGreaterThan(0);
      }
    });
  });

  describe('bySlug', () => {
    it('resolves a product from its category slug and product slug', async () => {
      const product = PRODUCTS.find((p) => p.categoryId === 'food')!;
      const found = await firstValueFrom(repo.bySlug('food', product.slug));
      expect(found?.id).toBe(product.id);
    });

    it('returns null for an unknown category rather than throwing', async () => {
      expect(await firstValueFrom(repo.bySlug('nope', 'nope'))).toBeNull();
    });

    it('will not resolve a product under the wrong category', async () => {
      const product = PRODUCTS.find((p) => p.categoryId === 'food')!;
      expect(await firstValueFrom(repo.bySlug('hygiene', product.slug))).toBeNull();
    });
  });

  it('counts products per category consistently with the catalogue', async () => {
    const counts = await firstValueFrom(repo.countByCategory());
    for (const category of CATEGORIES) {
      const expected = PRODUCTS.filter((p) => p.categoryId === category.id).length;
      expect(counts[category.id]).toBe(expected);
      expect(counts[category.id]).toBeGreaterThan(0);
    }
    expect(Object.values(counts).reduce((total, count) => total + count, 0)).toBe(PRODUCTS.length);
  });
});
