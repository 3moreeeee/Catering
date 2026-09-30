import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import fr from '../../../../public/i18n/fr.json';
import { AdminApiService, AdminProduct, ProductPayload } from '../../core/admin/admin-api.service';
import { ProductsAdminPage } from './products-admin.page';

const bonnet: AdminProduct = {
  id: 'uuid-bonnet',
  sourceId: 'p-fk-bonnet-de-douche',
  slug: 'catalogue-bonnet-de-douche',
  name: { fr: 'Bonnet de douche', en: 'Shower cap' },
  shortDescription: null,
  description: null,
  categoryId: 'hygiene',
  subcategoryId: 'headwear',
  brandId: null,
  industries: [],
  price: 12,
  currency: 'TND',
  offerPrice: null,
  offerStartsAt: null,
  offerEndsAt: null,
  offerActive: false,
  offerCurrentlyActive: false,
  stockQuantity: null,
  reference: null,
  technicalSheetUrl: null,
  featured: false,
  active: true,
  needsVerification: false,
  seoTitle: null,
  seoDescription: null,
  images: [],
  formats: [
    {
      id: 'p-fk-bonnet-de-douche-f1',
      value: 'Pack de 100',
      packQuantity: 100,
      sizeBucket: null,
      reference: null,
    },
  ],
  createdAt: '',
  updatedAt: '',
  saleMode: 'PACK_ONLY',
  unitPrice: 0.12,
  packQuantity: 100,
  unitLabel: 'piece',
  packPrice: 12,
};

function setup() {
  const api = {
    products: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 0, pageSize: 25, totalPages: 0 }),
    categories: vi.fn().mockResolvedValue([]),
    brands: vi.fn().mockResolvedValue([]),
    product: vi.fn().mockResolvedValue(bonnet),
    createProduct: vi.fn().mockResolvedValue(bonnet),
    updateProduct: vi.fn().mockResolvedValue(bonnet),
  };
  TestBed.configureTestingModule({
    imports: [
      ProductsAdminPage,
      TranslocoTestingModule.forRoot({
        langs: { fr },
        preloadLangs: true,
        translocoConfig: { defaultLang: 'fr', availableLangs: ['fr'] },
      }),
    ],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: AdminApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
    ],
  });
  const fixture = TestBed.createComponent(ProductsAdminPage);
  return { page: fixture.componentInstance, fixture, api };
}

describe('Products admin — pack pricing', () => {
  it('previews the pack price as the administrator types, and sends only the two factors', async () => {
    const { page, fixture, api } = setup();
    page.startCreate();
    page.form.patchValue({ nameFr: 'Bonnet de douche', categoryId: 'hygiene' });
    page.onNameInput();
    page.form.controls.saleMode.setValue('PACK_ONLY');
    page.onSaleModeChange();
    page.form.patchValue({ unitPrice: '0,120', packQuantity: '100' });
    await fixture.whenStable();

    expect(page.packPreview()?.packMillimes).toBe(12000);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="pack-price"]')
        ?.textContent,
    ).toContain('12,000 TND');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="pack-preview"]')
        ?.textContent,
    ).toContain('Vendu par lot de 100 pièces');

    // No reload: a new pack size re-prices the preview at once.
    page.form.controls.packQuantity.setValue('200');
    await fixture.whenStable();
    expect(page.packPreview()?.packMillimes).toBe(24000);

    await page.save();
    const payload = api.createProduct.mock.calls[0]![0] as ProductPayload;
    expect(payload).toMatchObject({
      saleMode: 'PACK_ONLY',
      unitPrice: 0.12,
      packQuantity: 200,
      unitLabel: 'piece',
      price: null,
    });
  });

  it('refuses a pack without a valid unit price or a whole pack size', async () => {
    const { page, api } = setup();
    page.startCreate();
    page.form.patchValue({ nameFr: 'Test', categoryId: 'hygiene' });
    page.onNameInput();
    page.form.controls.saleMode.setValue('PACK_ONLY');
    page.onSaleModeChange();
    const invalid: readonly (readonly [string, string])[] = [
      ['', '100'],
      ['0', '100'],
      ['0,1234', '100'],
      ['0,120', '100.5'],
      ['0,120', '0'],
      ['0,120', ''],
    ];
    for (const [unitPrice, packQuantity] of invalid) {
      page.form.patchValue({ unitPrice, packQuantity });
      await page.save();
    }
    expect(api.createProduct).not.toHaveBeenCalled();
    expect(page.invalidCount()).toBeGreaterThan(0);
  });

  it('edits an existing pack product and saves the new pack size', async () => {
    const { page, api } = setup();
    await page.edit({ ...bonnet });
    expect(page.form.getRawValue()).toMatchObject({
      saleMode: 'PACK_ONLY',
      unitPrice: '0.120',
      packQuantity: '100',
      unitLabel: 'piece',
    });
    expect(page.packPreview()?.packMillimes).toBe(12000);

    page.form.controls.packQuantity.setValue('200');
    await page.save();
    const [id, payload] = api.updateProduct.mock.calls[0]! as [string, ProductPayload];
    expect(id).toBe('uuid-bonnet');
    expect(payload).toMatchObject({ unitPrice: 0.12, packQuantity: 200, saleMode: 'PACK_ONLY' });
    // Everything the editor does not show travels back untouched.
    expect(payload.formats[0]).toMatchObject({ value: 'Pack de 100' });
  });

  it('keeps a unit product on its directly entered price', async () => {
    const { page, api } = setup();
    page.startCreate();
    page.form.patchValue({ nameFr: 'Sirop', categoryId: 'monin', price: '27,406' });
    page.onNameInput();
    await page.save();
    expect(api.createProduct.mock.calls[0]![0]).toMatchObject({
      saleMode: 'UNIT',
      price: 27.406,
      unitPrice: null,
      packQuantity: null,
    });
  });
});
