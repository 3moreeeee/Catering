/* eslint-disable @typescript-eslint/unbound-method -- Angular's Validators are static, context-free functions. */
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  AdminApiService,
  AdminBrand,
  AdminCategory,
  AdminProduct,
  AdminProductQuery,
  Page,
  ProductPayload,
  UploadedMedia,
} from '../../core/admin/admin-api.service';

/**
 * Product management.
 *
 * Price is editable straight from the list, because repricing is the most
 * frequent task and opening a full form for one number is friction. Everything
 * else goes through the editor. Deleting is a soft delete — a deactivated
 * product leaves the storefront but stays here, where it can be reactivated —
 * because past quotes still refer to it.
 *
 * The editor exposes the fields an administrator maintains day to day. Fields
 * it does not show (long descriptions, SEO, formats, extra images, industries)
 * are carried over untouched from the loaded product, never blanked, because the
 * API replaces the whole record on update.
 */
@Component({
  selector: 'fk-products-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, TranslocoDirective],
  templateUrl: './products-admin.page.html',
})
export class ProductsAdminPage {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);

  readonly page = signal<Page<AdminProduct> | null>(null);
  readonly categories = signal<readonly AdminCategory[]>([]);
  readonly brands = signal<readonly AdminBrand[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploadingImage = signal(false);
  readonly uploadedImage = signal<UploadedMedia | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly editorOpen = signal(false);
  /** How many controls failed the last submit; drives the summary above the form. */
  readonly invalidCount = signal(0);
  readonly editing = signal<AdminProduct | null>(null);
  /** Id of the row whose inline price save is in flight or just succeeded. */
  readonly priceSaving = signal<string | null>(null);
  readonly priceSaved = signal<string | null>(null);

  // Mutable on purpose: the filter controls bind to it with ngModel.
  query: {
    q: string;
    category: string;
    status: NonNullable<AdminProductQuery['status']>;
    priced: NonNullable<AdminProductQuery['priced']>;
  } = {
    q: '',
    category: '',
    status: '',
    priced: '',
  };
  private pageIndex = 0;
  private generatedSuffix = '';

  readonly form = this.fb.nonNullable.group({
    sourceId: ['', [Validators.required, Validators.maxLength(120)]],
    slug: [
      '',
      [
        Validators.required,
        Validators.maxLength(200),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    ],
    nameFr: ['', [Validators.required, Validators.maxLength(255)]],
    nameEn: ['', Validators.maxLength(255)],
    categoryId: ['', Validators.required],
    subcategoryId: [''],
    brandId: [''],
    price: ['', Validators.pattern(/^\d{1,7}([.,]\d{1,3})?$/)],
    stockQuantity: ['', Validators.pattern(/^\d+$/)],
    reference: ['', Validators.maxLength(120)],
    shortDescriptionFr: ['', Validators.maxLength(1000)],
    shortDescriptionEn: ['', Validators.maxLength(1000)],
    imageSrc: ['', Validators.maxLength(500)],
    imageAltFr: ['', Validators.maxLength(500)],
    featured: [false],
  });

  /**
   * The API error code, narrowed to one we have a message for. Transloco
   * returns the key itself for a missing translation, so an unknown code would
   * otherwise surface to the administrator as "dashboard.errors.some_code".
   */
  private static readonly KNOWN_ERRORS = new Set([
    'invalid_price',
    'product_slug_exists',
    'product_source_id_exists',
    'product_not_found',
    'validation_failed',
    'image_invalid',
    'image_upload_failed',
    'forbidden',
    'unauthorized',
  ]);
  readonly errorKey = computed(() =>
    ProductsAdminPage.KNOWN_ERRORS.has(this.error()) ? this.error() : 'unknown',
  );

  readonly selectedCategory = signal('');
  readonly subcategories = computed(
    () =>
      this.categories().find((c) => c.externalId === this.selectedCategory())?.subcategories ?? [],
  );

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    // Deep links from the overview ("sans prix") arrive as query parameters.
    const params = this.route.snapshot.queryParamMap;
    this.query.priced = (params.get('priced') as '' | 'yes' | 'no') ?? '';
    this.query.status = (params.get('status') as '' | 'active' | 'inactive') ?? '';
    void this.load();
    this.api.categories().then(
      (items) => this.categories.set(items),
      () => undefined,
    );
    this.api.brands().then(
      (items) => this.brands.set(items),
      () => undefined,
    );
  }

  async load(pageIndex = 0): Promise<void> {
    this.pageIndex = pageIndex;
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(await this.api.products({ ...this.query, page: pageIndex, pageSize: 25 }));
    } catch (error) {
      this.error.set(AdminApiService.errorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  search(): void {
    void this.load(0);
  }

  categoryName(id: string): string {
    const category = this.categories().find((c) => c.externalId === id);
    return category ? (category.name.fr ?? id) : id;
  }

  price(value: number | null): string {
    return value === null
      ? this.transloco.translate('cart.priceOnRequest')
      : `${value.toFixed(3)} TND`;
  }

  // --- Inline price ----------------------------------------------------------

  async savePrice(product: AdminProduct, raw: string): Promise<void> {
    const trimmed = raw.trim().replace(',', '.');
    // An emptied field means "prix sur demande", which is a legitimate choice,
    // not a validation error.
    const price = trimmed === '' ? null : Number(trimmed);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      this.error.set('invalid_price');
      return;
    }
    if (price === product.price) return;
    this.priceSaving.set(product.id);
    this.error.set('');
    try {
      const updated = await this.api.updatePrice(product.id, price);
      this.replace(updated);
      this.priceSaved.set(product.id);
      setTimeout(() => this.priceSaved.set(null), 1600);
    } catch (error) {
      this.error.set(AdminApiService.errorCode(error));
    } finally {
      this.priceSaving.set(null);
    }
  }

  // --- Activation ------------------------------------------------------------

  async deactivate(product: AdminProduct): Promise<void> {
    const confirmed = this.document.defaultView?.confirm(
      this.transloco.translate('dashboard.products.deactivateConfirm', { name: product.name.fr }),
    );
    if (!confirmed) return;
    try {
      await this.api.deactivateProduct(product.id);
      this.success.set('deactivated');
      await this.load(this.pageIndex);
    } catch (error) {
      this.error.set(AdminApiService.errorCode(error));
    }
  }

  async reactivate(product: AdminProduct): Promise<void> {
    try {
      this.replace(await this.api.reactivateProduct(product.id));
      this.success.set('reactivated');
    } catch (error) {
      this.error.set(AdminApiService.errorCode(error));
    }
  }

  // --- Editor ----------------------------------------------------------------

  startCreate(): void {
    this.editing.set(null);
    this.generatedSuffix = Date.now().toString(36).slice(-6);
    this.uploadedImage.set(null);
    this.form.reset({
      sourceId: '',
      slug: '',
      nameFr: '',
      nameEn: '',
      categoryId: '',
      subcategoryId: '',
      brandId: '',
      price: '',
      stockQuantity: '',
      reference: '',
      shortDescriptionFr: '',
      shortDescriptionEn: '',
      imageSrc: '',
      imageAltFr: '',
      featured: false,
    });
    this.selectedCategory.set('');
    this.openEditor();
  }

  async edit(product: AdminProduct): Promise<void> {
    this.error.set('');
    try {
      // Re-read the record: the list row may be stale, and the payload has to
      // carry every field the editor does not show.
      const full = await this.api.product(product.id);
      this.uploadedImage.set(null);
      this.editing.set(full);
      this.form.reset({
        sourceId: full.sourceId,
        slug: full.slug,
        nameFr: full.name.fr ?? '',
        nameEn: full.name.en ?? '',
        categoryId: full.categoryId,
        subcategoryId: full.subcategoryId ?? '',
        brandId: full.brandId ?? '',
        price: full.price === null ? '' : full.price.toFixed(3),
        stockQuantity: full.stockQuantity === null ? '' : String(full.stockQuantity),
        reference: full.reference ?? '',
        shortDescriptionFr: full.shortDescription?.fr ?? '',
        shortDescriptionEn: full.shortDescription?.en ?? '',
        imageSrc: full.images[0]?.src ?? '',
        imageAltFr: full.images[0]?.alt?.fr ?? '',
        featured: full.featured,
      });
      this.selectedCategory.set(full.categoryId);
      this.openEditor();
    } catch (error) {
      this.error.set(AdminApiService.errorCode(error));
    }
  }

  onCategoryChange(value: string): void {
    this.selectedCategory.set(value);
    this.form.controls.subcategoryId.setValue('');
  }

  /** Technical identifiers and image alt text stay synchronized while creating. */
  onNameInput(): void {
    if (this.editing()) return;
    const name = this.form.controls.nameFr.value.trim();
    const base = ProductsAdminPage.slugify(name).slice(0, 190);
    const slug = base ? `${base}-${this.generatedSuffix}` : '';
    this.form.controls.slug.setValue(slug);
    this.form.controls.sourceId.setValue(
      base ? `p-${base.slice(0, 100)}-${this.generatedSuffix}` : '',
    );
    this.form.controls.imageAltFr.setValue(name ? `${name} — photographie du produit` : '');
  }

  async uploadImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      this.error.set('image_invalid');
      input.value = '';
      return;
    }
    this.uploadingImage.set(true);
    this.error.set('');
    try {
      const uploaded = await this.api.uploadProductImage(file);
      this.uploadedImage.set(uploaded);
      this.form.controls.imageSrc.setValue(uploaded.url);
      this.form.controls.imageSrc.markAsDirty();
    } catch {
      this.error.set('image_upload_failed');
    } finally {
      this.uploadingImage.set(false);
      input.value = '';
    }
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.editing.set(null);
    this.uploadedImage.set(null);
    this.invalidCount.set(0);
  }

  /** True once the administrator has had a chance to see the field. */
  hasError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  /**
   * The message for the first failing rule on a field.
   *
   * <p>Each rule names the field it is about, because the editor shows fifteen
   * controls at once and a bare "required" under one of them is ambiguous once
   * the page has scrolled.
   */
  errorFor(field: keyof typeof this.form.controls): string {
    const control = this.form.controls[field];
    const label = this.transloco.translate(`dashboard.products.fields.${field}`);

    if (control.hasError('required')) {
      return this.transloco.translate('dashboard.products.validation.required', { field: label });
    }
    if (control.hasError('maxlength')) {
      const limit = control.getError('maxlength') as { requiredLength: number };
      return this.transloco.translate('dashboard.products.validation.maxlength', {
        field: label,
        max: limit.requiredLength,
      });
    }
    if (control.hasError('pattern')) {
      // The three patterned fields each need their own explanation: telling an
      // administrator that a price "does not match the expected format" does
      // not tell them that the separator may be a comma.
      const key =
        field === 'slug'
          ? 'slug'
          : field === 'price'
            ? 'price'
            : field === 'stockQuantity'
              ? 'stock'
              : 'slug';
      return this.transloco.translate(`dashboard.products.validation.${key}`);
    }
    return '';
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const invalid = Object.keys(this.form.controls).filter(
      (name) => this.form.get(name)?.invalid ?? false,
    );
    this.invalidCount.set(invalid.length);
    // Submitting a form that silently does nothing reads as a broken button.
    // Move the caret to the first offending control so the cause is on screen.
    const first = invalid[0];
    if (first !== undefined) {
      this.focusField(first);
      return;
    }
    if (this.form.invalid || this.saving() || this.uploadingImage()) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const existing = this.editing();
      const payload = this.payload(existing);
      if (existing) {
        await this.api.updateProduct(existing.id, payload);
      } else {
        await this.api.createProduct(payload);
      }
      this.success.set(existing ? 'updated' : 'created');
      this.closeEditor();
      await this.load(existing ? this.pageIndex : 0);
    } catch (error) {
      this.error.set(AdminApiService.errorCode(error));
    } finally {
      this.saving.set(false);
    }
  }

  private payload(existing: AdminProduct | null): ProductPayload {
    const v = this.form.getRawValue();
    const blank = (value: string) => (value.trim() === '' ? null : value.trim());
    const price = blank(v.price);
    const stock = blank(v.stockQuantity);

    // The first image is the one the editor exposes; any further images are
    // preserved as they were.
    const keptImages = (existing?.images ?? []).slice(1).map((image) => ({
      src: image.src,
      altFr: image.alt?.fr ?? v.nameFr,
      altEn: image.alt?.en ?? null,
      width: image.width,
      height: image.height,
    }));
    const firstImage = blank(v.imageSrc)
      ? [
          {
            src: v.imageSrc.trim(),
            altFr: blank(v.imageAltFr) ?? v.nameFr,
            altEn: existing?.images[0]?.alt?.en ?? null,
            width:
              this.uploadedImage()?.url === v.imageSrc.trim()
                ? this.uploadedImage()!.width
                : existing?.images[0]?.src === v.imageSrc.trim()
                  ? existing.images[0].width
                  : null,
            height:
              this.uploadedImage()?.url === v.imageSrc.trim()
                ? this.uploadedImage()!.height
                : existing?.images[0]?.src === v.imageSrc.trim()
                  ? existing.images[0].height
                  : null,
          },
        ]
      : [];

    return {
      sourceId: v.sourceId.trim(),
      slug: v.slug.trim(),
      nameFr: v.nameFr.trim(),
      nameEn: blank(v.nameEn),
      shortDescriptionFr: blank(v.shortDescriptionFr),
      shortDescriptionEn: blank(v.shortDescriptionEn),
      descriptionFr: existing?.description?.fr ?? null,
      descriptionEn: existing?.description?.en ?? null,
      categoryId: v.categoryId,
      subcategoryId: blank(v.subcategoryId),
      brandId: blank(v.brandId),
      industries: existing?.industries ?? [],
      price: price === null ? null : Number(price.replace(',', '.')),
      currency: price === null ? null : 'TND',
      stockQuantity: stock === null ? null : Number(stock),
      reference: blank(v.reference),
      technicalSheetUrl: existing?.technicalSheetUrl ?? null,
      featured: v.featured,
      needsVerification: existing?.needsVerification ?? false,
      seoTitleFr: existing?.seoTitle?.fr ?? null,
      seoTitleEn: existing?.seoTitle?.en ?? null,
      seoDescriptionFr: existing?.seoDescription?.fr ?? null,
      seoDescriptionEn: existing?.seoDescription?.en ?? null,
      images: [...firstImage, ...keptImages],
      formats: (existing?.formats ?? []).map((format) => ({
        id: format.id,
        value: format.value,
        packQuantity: format.packQuantity,
        sizeBucket: format.sizeBucket,
        reference: format.reference,
      })),
    };
  }

  /**
   * The element id each control is rendered under, so a validation failure can
   * put the caret on the offending input rather than only colour it red.
   */
  private static readonly FIELD_IDS: Readonly<Record<string, string>> = {
    nameFr: 'p-name-fr',
    nameEn: 'p-name-en',
    sourceId: 'p-source',
    slug: 'p-slug',
    categoryId: 'p-category',
    subcategoryId: 'p-sub',
    brandId: 'p-brand',
    reference: 'p-ref',
    price: 'p-price',
    stockQuantity: 'p-stock',
    shortDescriptionFr: 'p-short-fr',
    shortDescriptionEn: 'p-short-en',
    imageSrc: 'p-img',
    imageAltFr: 'p-img-alt',
  };

  private focusField(name: string): void {
    const id = ProductsAdminPage.FIELD_IDS[name];
    if (!id) return;
    queueMicrotask(() => {
      const element = this.document.getElementById(id);
      if (!(element instanceof HTMLElement)) return;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  private openEditor(): void {
    this.editorOpen.set(true);
    this.error.set('');
    this.invalidCount.set(0);
    queueMicrotask(() => {
      this.document.getElementById('product-editor')?.scrollIntoView({ behavior: 'smooth' });
      // Scrolling alone leaves keyboard focus on the "Edit" button back up the
      // table, so the next Tab walks the list again instead of entering the
      // form that just appeared.
      this.document.getElementById('p-name-fr')?.focus({ preventScroll: true });
    });
  }

  private replace(updated: AdminProduct): void {
    this.page.update((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === updated.id ? updated : item)),
          }
        : current,
    );
  }

  private static slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }
}
