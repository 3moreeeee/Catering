import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { IDENTITY_API_URL } from '../../core/auth/identity-api.token';
import { IMAGEKIT_URL_ENDPOINT } from '../../core/config/imagekit.generated';
import { ApiProductRepository, CATALOG_PAGE_SIZE } from './api-product.repository';

const apiProduct = (sourceId: string, src: string, categoryId = 'monin') => ({
  sourceId,
  slug: sourceId,
  name: { fr: sourceId, en: sourceId },
  shortDescription: null,
  description: null,
  categoryId,
  subcategoryId: null,
  brandId: null,
  industries: [],
  formats: [],
  images: [{ src, alt: null, width: 800, height: 800, metrics: null }],
  colorVariants: [],
  featured: false,
  price: null,
  currency: null,
  offerPrice: null,
  offerStartsAt: null,
  offerEndsAt: null,
  offerActive: false,
  offerCurrentlyActive: false,
  technicalSheetUrl: null,
  seoTitle: null,
  seoDescription: null,
  needsVerification: false,
});

function setup(platform: 'browser' | 'server' = 'browser'): {
  repo: ApiProductRepository;
  http: HttpTestingController;
} {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: platform },
      { provide: IDENTITY_API_URL, useValue: '/api' },
    ],
  });
  return {
    repo: TestBed.inject(ApiProductRepository),
    http: TestBed.inject(HttpTestingController),
  };
}

/**
 * The catalogue comes from the API one bounded request at a time, and every
 * image it returns goes through the same ImageKit normalisation.
 */
describe('ApiProductRepository', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('serves relative keys from ImageKit and keeps full ImageKit URLs as stored', async () => {
    const { repo, http } = setup();
    const relative = '/img/products/catalogue/monin-sirop-caramel-1l.v2.webp';
    const hosted =
      'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/SIROP-CHOCOLAT-COOKIES_mDYSNk_tx.png';

    const page = firstValueFrom(repo.list({ page: 1 }));
    http
      .expectOne((request) => request.url === '/api/products')
      .flush({
        items: [apiProduct('p-test-relative', relative), apiProduct('p-test-hosted', hosted)],
        page: 0,
        pageSize: 12,
        total: 2,
        totalPages: 1,
      });
    const byId = new Map((await page).items.map((product) => [product.id, product]));

    const expected = `${IMAGEKIT_URL_ENDPOINT}/fk-catering${relative}`;
    expect(byId.get('p-test-relative')?.images[0]?.src).toBe(expected);
    expect(byId.get('p-test-relative')?.seo.ogImage).toBe(expected);
    expect(byId.get('p-test-hosted')?.images[0]?.src).toBe(hosted);
    expect(byId.get('p-test-hosted')?.seo.ogImage).toBe(hosted);
  });

  it('asks the server for one page of at most 12, with the filters, and maps page numbers', async () => {
    const { repo, http } = setup();
    const page = firstValueFrom(
      repo.list({
        page: 3,
        pageSize: 100,
        q: 'sirop',
        categories: ['monin'],
        brands: ['monin', 'emporium'],
        sort: 'name-asc',
      }),
    );
    const request = http.expectOne((r) => r.url === '/api/products');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe(String(CATALOG_PAGE_SIZE));
    expect(CATALOG_PAGE_SIZE).toBe(12);
    expect(request.request.params.get('q')).toBe('sirop');
    expect(request.request.params.get('category')).toBe('monin');
    expect(request.request.params.get('brand')).toBe('monin,emporium');
    expect(request.request.params.get('sort')).toBe('name-asc');
    request.flush({ items: [], page: 2, pageSize: 12, total: 30, totalPages: 3 });
    const result = await page;
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.total).toBe(30);
  });

  it('looks a product up by slug and rejects it under another division', async () => {
    const { repo, http } = setup();
    const inMonin = firstValueFrom(repo.bySlug('monin', 'p-1'));
    http.expectOne('/api/products/p-1').flush(apiProduct('p-1', '/img/products/x.webp', 'monin'));
    expect((await inMonin)?.id).toBe('p-1');

    const elsewhere = firstValueFrom(repo.bySlug('food', 'p-1'));
    http.expectOne('/api/products/p-1').flush(apiProduct('p-1', '/img/products/x.webp', 'monin'));
    expect(await elsewhere).toBeNull();

    const missing = firstValueFrom(repo.bySlug('monin', 'gone'));
    http
      .expectOne('/api/products/gone')
      .flush({ code: 'product_not_found' }, { status: 404, statusText: 'Not Found' });
    expect(await missing).toBeNull();
  });

  it('requests bounded selections for featured and related products', async () => {
    const { repo, http } = setup();
    const featured = firstValueFrom(repo.featured(5, 'food'));
    const request = http.expectOne((r) => r.url === '/api/products/featured');
    expect(request.request.params.get('limit')).toBe('5');
    expect(request.request.params.get('category')).toBe('food');
    request.flush([apiProduct('p-2', '/img/products/y.webp', 'food')]);
    expect((await featured).map((p) => p.id)).toEqual(['p-2']);

    const related = firstValueFrom(repo.related((await featured)[0]!.slug, 4));
    const relatedRequest = http.expectOne((r) => r.url === '/api/products/p-2/related');
    expect(relatedRequest.request.params.get('limit')).toBe('4');
    relatedRequest.flush([]);
    expect(await related).toEqual([]);
  });

  it('calls nothing while prerendering at build time', async () => {
    const { repo } = setup('server');
    expect((await firstValueFrom(repo.list({ page: 1 }))).items).toEqual([]);
    expect(await firstValueFrom(repo.stats())).toBeNull();
    expect(await firstValueFrom(repo.byProductSlug('p-1'))).toBeNull();
  });
});
