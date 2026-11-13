import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  AdminApiService,
  AdminBrand,
  AdminCategory,
  ImportAction,
  ImportItem,
  ImportList,
  ImportStatus,
  PriceList,
  flattenSubcategories,
} from '../../core/admin/admin-api.service';
/**
 * The closed sector list the API accepts (ImportTaxonomy.INDUSTRIES). Labels
 * are repeated here because catalogue data files may not be imported by pages.
 */
const SECTORS = [
  { id: 'restaurants', label: 'Restauration et cafés' },
  { id: 'hotels', label: 'Hôtellerie et traiteurs' },
  { id: 'retail', label: 'Grande distribution' },
  { id: 'food-production', label: 'Industrie agro-alimentaire' },
  { id: 'healthcare', label: 'Santé' },
  { id: 'pharmaceutical', label: 'Industrie pharmaceutique' },
] as const;

type View = 'ACTIVE' | 'PUBLISHED' | 'DISCARDED';

interface UploadRow {
  readonly key: number;
  readonly name: string;
  state: 'waiting' | 'uploading' | 'done' | 'error';
  error?: string | undefined;
}

/** The administrator's working copy of one proposal, edited in place. */
interface Draft {
  action: ImportAction;
  matchedProductId: string | null;
  nameFr: string;
  nameEn: string;
  shortDescriptionFr: string;
  shortDescriptionEn: string;
  descriptionFr: string;
  descriptionEn: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  industries: string[];
  formatValue: string;
  packQuantity: string;
  unitLabel: string;
  saleMode: 'UNIT' | 'PACK_ONLY';
  price: string;
  unitPrice: string;
}

const UPLOAD_PARALLEL = 2;
const POLL_MS = 4000;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/**
 * AI product import: drop photographs, the server asks a vision model for the
 * product sheet, and the administrator reviews, prices and publishes each one.
 *
 * Nothing reaches the public catalogue from here without the Publish button,
 * and publishing a new product requires a price typed by a person.
 */
@Component({
  selector: 'fk-ai-import-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'dashboard.aiImport'">
      @if (error()) {
        <p class="account-status is-error" role="alert">{{ error() }}</p>
      }

      <section class="account-card">
        <div class="admin-section-head">
          <div>
            <h2>{{ t('title') }}</h2>
            <p class="admin-count">{{ t('lead') }}</p>
          </div>
          @if (list(); as data) {
            <span class="admin-badge" [attr.data-status]="data.configured ? 'ACTIVE' : 'INACTIVE'">
              {{ data.configured ? t('model', { model: data.model }) : t('notConfigured') }}
            </span>
          }
        </div>

        <label
          class="ai-drop"
          [class.is-over]="dragging()"
          [class.is-disabled]="!list()?.configured"
          (dragover)="$event.preventDefault(); dragging.set(true)"
          (dragleave)="dragging.set(false)"
          (drop)="onDrop($event)"
        >
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            [disabled]="!list()?.configured"
            (change)="onPick($event)"
          />
          <strong>{{ t('dropTitle') }}</strong>
          <span>{{ t('dropHint') }}</span>
        </label>

        @if (uploads().length) {
          <p class="admin-count">
            {{ t('uploadProgress', { done: uploadsDone(), total: uploads().length }) }}
          </p>
          <ul class="ai-uploads">
            @for (row of uploads(); track row.key) {
              @if (row.state !== 'done') {
                <li [attr.data-state]="row.state">
                  <span>{{ row.name }}</span>
                  <small
                    >{{ t('upload.' + row.state) }}{{ row.error ? ' — ' + row.error : '' }}</small
                  >
                </li>
              }
            }
          </ul>
        }
      </section>

      <!-- The company's price lists: loaded once, then every photo finds its price in them. -->
      <section class="account-card">
        <div class="admin-section-head">
          <div>
            <h2>{{ t('priceLists.title') }}</h2>
            <p class="admin-count">{{ t('priceLists.lead') }}</p>
          </div>
          <label class="btn btn--secondary btn--sm ai-pdf-button">
            <input
              type="file"
              multiple
              accept="application/pdf,.pdf"
              (change)="onPickPriceLists($event)"
            />
            {{ priceListBusy() ? t('working') : t('priceLists.add') }}
          </label>
        </div>
        @if (priceLists().length) {
          <ul class="ai-pricelists">
            @for (list of priceLists(); track list.listName) {
              <li>
                <strong>{{ list.listName }}</strong>
                <span class="u-nums">{{ t('priceLists.rows', { count: list.rows }) }}</span>
                <small>{{ list.sourceFile }}</small>
              </li>
            }
          </ul>
        } @else {
          <p class="account-status ai-warning">{{ t('priceLists.empty') }}</p>
        }
      </section>

      <section class="account-card">
        <div class="admin-section-head">
          <div class="ai-views" role="tablist">
            @for (option of views; track option) {
              <button
                type="button"
                role="tab"
                class="btn btn--sm"
                [class.btn--primary]="view() === option"
                [class.btn--secondary]="view() !== option"
                [attr.aria-selected]="view() === option"
                (click)="setView(option)"
              >
                {{ t('views.' + option) }}
              </button>
            }
          </div>
          @if (list(); as data) {
            <p class="admin-count ai-counts">
              @for (status of countOrder; track status) {
                <span class="admin-badge" [attr.data-status]="status"
                  >{{ t('status.' + status) }} · {{ data.counts[status] }}</span
                >
              }
            </p>
          }
        </div>

        @if (loading() && !list()) {
          <p class="admin-empty">{{ t('loading') }}</p>
        } @else if (!list()?.items?.length) {
          <p class="admin-empty">{{ t('empty') }}</p>
        } @else {
          <div class="ai-items">
            @for (item of list()!.items; track item.id) {
              <article class="ai-item" [attr.data-status]="item.status">
                <div class="ai-item__images">
                  <figure>
                    <img
                      [src]="item.imageUrl + '?tr=w-320'"
                      [alt]="item.originalFilename"
                      loading="lazy"
                    />
                    <figcaption>{{ t('original') }}</figcaption>
                  </figure>
                  @if (item.displayUrl !== item.imageUrl) {
                    <figure class="ai-item__clean">
                      <!-- The exact stored URL: a resized variant would be a second
                           background removal billed by ImageKit. -->
                      <img [src]="item.displayUrl" [alt]="''" loading="lazy" />
                      <figcaption>{{ t('cleaned') }}</figcaption>
                    </figure>
                  }
                </div>

                <div class="ai-item__body">
                  <header class="ai-item__head">
                    <span class="admin-person"
                      ><strong>{{ item.nameFr || item.originalFilename }}</strong
                      ><small>{{ item.originalFilename }}</small></span
                    >
                    <span class="admin-badge" [attr.data-status]="item.status">{{
                      t('status.' + item.status)
                    }}</span>
                  </header>

                  @if (item.warning && item.status === 'READY') {
                    <p class="account-status ai-warning" role="alert">⚠ {{ item.warning }}</p>
                  }

                  @switch (item.status) {
                    @case ('QUEUED') {
                      <p class="admin-empty">{{ t('queuedHint') }}</p>
                    }
                    @case ('PROCESSING') {
                      <p class="admin-empty">{{ t('processingHint') }}</p>
                    }
                    @case ('FAILED') {
                      <p class="account-status is-error">{{ item.error || t('failedHint') }}</p>
                      <div class="admin-actions">
                        <button
                          class="btn btn--secondary btn--sm"
                          type="button"
                          (click)="retry(item)"
                        >
                          {{ t('retry') }}</button
                        ><button
                          class="btn btn--ghost btn--sm"
                          type="button"
                          (click)="discard(item)"
                        >
                          {{ t('discard') }}
                        </button>
                      </div>
                    }
                    @case ('PUBLISHED') {
                      <p class="admin-empty">
                        {{
                          item.action === 'REPLACE_IMAGE'
                            ? t('publishedReplace')
                            : t('publishedCreate')
                        }}
                      </p>
                    }
                    @case ('DISCARDED') {
                      <p class="admin-empty">{{ t('discardedHint') }}</p>
                    }
                    @case ('READY') {
                      @if (draftFor(item); as d) {
                        <form class="account-form" (ngSubmit)="publish(item)">
                          @if (item.matchedProductId) {
                            <fieldset class="ai-action">
                              <legend class="field__label">{{ t('actionLabel') }}</legend>
                              <label
                                ><input
                                  type="radio"
                                  [name]="'action-' + item.id"
                                  value="REPLACE_IMAGE"
                                  [(ngModel)]="d.action"
                                />
                                {{ t('actionReplace', { name: item.matchedProductName }) }}</label
                              >
                              <label
                                ><input
                                  type="radio"
                                  [name]="'action-' + item.id"
                                  value="CREATE"
                                  [(ngModel)]="d.action"
                                />
                                {{ t('actionCreate') }}</label
                              >
                            </fieldset>
                          }

                          @if (d.action === 'CREATE') {
                            <div class="account-form__grid">
                              <label class="field">
                                <span class="field__label">{{ t('fields.nameFr') }}</span>
                                <input
                                  class="control"
                                  [name]="'nameFr-' + item.id"
                                  [(ngModel)]="d.nameFr"
                                  required
                                />
                              </label>
                              <label class="field">
                                <span class="field__label">{{ t('fields.nameEn') }}</span>
                                <input
                                  class="control"
                                  [name]="'nameEn-' + item.id"
                                  [(ngModel)]="d.nameEn"
                                />
                              </label>
                              <label class="field">
                                <span class="field__label">{{
                                  t('fields.shortDescriptionFr')
                                }}</span>
                                <textarea
                                  class="control"
                                  rows="2"
                                  [name]="'sdFr-' + item.id"
                                  [(ngModel)]="d.shortDescriptionFr"
                                ></textarea>
                              </label>
                              <label class="field">
                                <span class="field__label">{{
                                  t('fields.shortDescriptionEn')
                                }}</span>
                                <textarea
                                  class="control"
                                  rows="2"
                                  [name]="'sdEn-' + item.id"
                                  [(ngModel)]="d.shortDescriptionEn"
                                ></textarea>
                              </label>
                              <label class="field">
                                <span class="field__label">{{ t('fields.descriptionFr') }}</span>
                                <textarea
                                  class="control"
                                  rows="4"
                                  [name]="'dFr-' + item.id"
                                  [(ngModel)]="d.descriptionFr"
                                ></textarea>
                              </label>
                              <label class="field">
                                <span class="field__label">{{ t('fields.descriptionEn') }}</span>
                                <textarea
                                  class="control"
                                  rows="4"
                                  [name]="'dEn-' + item.id"
                                  [(ngModel)]="d.descriptionEn"
                                ></textarea>
                              </label>
                              <label class="field">
                                <span class="field__label">{{ t('fields.category') }}</span>
                                <select
                                  class="control"
                                  [name]="'cat-' + item.id"
                                  [(ngModel)]="d.categoryId"
                                  (change)="d.subcategoryId = ''"
                                  required
                                >
                                  @for (category of categories(); track category.externalId) {
                                    <option [value]="category.externalId">
                                      {{ category.name.fr }}
                                    </option>
                                  }
                                </select>
                              </label>
                              <label class="field">
                                <span class="field__label">{{ t('fields.subcategory') }}</span>
                                <select
                                  class="control"
                                  [name]="'sub-' + item.id"
                                  [(ngModel)]="d.subcategoryId"
                                >
                                  <option value="">—</option>
                                  @for (sub of subcategories(d.categoryId); track sub.externalId) {
                                    <option [value]="sub.externalId">{{ sub.name.fr }}</option>
                                  }
                                </select>
                              </label>
                              <label class="field">
                                <span class="field__label">{{ t('fields.brand') }}</span>
                                <select
                                  class="control"
                                  [name]="'brand-' + item.id"
                                  [(ngModel)]="d.brandId"
                                >
                                  <option value="">—</option>
                                  @for (brand of brands(); track brand.externalId) {
                                    <option [value]="brand.externalId">{{ brand.name }}</option>
                                  }
                                </select>
                              </label>
                              <label class="field">
                                <span class="field__label">{{ t('fields.format') }}</span>
                                <input
                                  class="control"
                                  [name]="'format-' + item.id"
                                  [(ngModel)]="d.formatValue"
                                />
                              </label>
                              <fieldset class="field account-form__full ai-industries">
                                <legend class="field__label">{{ t('fields.industries') }}</legend>
                                @for (industry of industries; track industry.id) {
                                  <label
                                    ><input
                                      type="checkbox"
                                      [checked]="d.industries.includes(industry.id)"
                                      (change)="toggleIndustry(d, industry.id)"
                                    />
                                    {{ industry.label }}</label
                                  >
                                }
                              </fieldset>
                            </div>
                          }

                          <!-- Where the price comes from: the company's own price list. -->
                          @if (item.priceSource) {
                            <p class="ai-price-source">
                              <strong>{{ t('priceFound') }}</strong> {{ item.priceSource }}
                              @if (item.priceNote) {
                                <small>{{ item.priceNote }}</small>
                              }
                            </p>
                          } @else if (item.priceNote) {
                            <p class="account-status ai-warning">{{ item.priceNote }}</p>
                          }

                          <div class="account-form__grid ai-price">
                            @if (d.action === 'CREATE') {
                              <label class="field">
                                <span class="field__label">{{ t('fields.saleMode') }}</span>
                                <select
                                  class="control"
                                  [name]="'mode-' + item.id"
                                  [(ngModel)]="d.saleMode"
                                >
                                  <option value="UNIT">{{ t('saleMode.UNIT') }}</option>
                                  <option value="PACK_ONLY">{{ t('saleMode.PACK_ONLY') }}</option>
                                </select>
                              </label>
                              @if (d.saleMode === 'UNIT') {
                                <label class="field">
                                  <span class="field__label">{{ t('fields.price') }}</span>
                                  <input
                                    class="control u-nums"
                                    [name]="'price-' + item.id"
                                    [(ngModel)]="d.price"
                                    inputmode="decimal"
                                    required
                                  />
                                </label>
                              } @else {
                                <label class="field">
                                  <span class="field__label">{{ t('fields.unitPrice') }}</span>
                                  <input
                                    class="control u-nums"
                                    [name]="'unitPrice-' + item.id"
                                    [(ngModel)]="d.unitPrice"
                                    inputmode="decimal"
                                    required
                                  />
                                </label>
                                <label class="field">
                                  <span class="field__label">{{ t('fields.packQuantity') }}</span>
                                  <input
                                    class="control u-nums"
                                    [name]="'pack-' + item.id"
                                    [(ngModel)]="d.packQuantity"
                                    inputmode="numeric"
                                    required
                                  />
                                </label>
                                <label class="field">
                                  <span class="field__label">{{ t('fields.unitLabel') }}</span>
                                  <select
                                    class="control"
                                    [name]="'unit-' + item.id"
                                    [(ngModel)]="d.unitLabel"
                                  >
                                    @for (unit of unitLabels; track unit) {
                                      <option [value]="unit">{{ unit }}</option>
                                    }
                                  </select>
                                </label>
                              }
                            } @else {
                              <!-- Existing product: its lot size is kept; only the
                                   price per piece (or per lot) is updated, when set. -->
                              @if (d.saleMode === 'PACK_ONLY') {
                                <label class="field">
                                  <span class="field__label">{{ t('fields.newUnitPrice') }}</span>
                                  <input
                                    class="control u-nums"
                                    [name]="'unitPrice-' + item.id"
                                    [(ngModel)]="d.unitPrice"
                                    inputmode="decimal"
                                  />
                                </label>
                              } @else {
                                <label class="field">
                                  <span class="field__label">{{ t('fields.newPrice') }}</span>
                                  <input
                                    class="control u-nums"
                                    [name]="'price-' + item.id"
                                    [(ngModel)]="d.price"
                                    inputmode="decimal"
                                  />
                                </label>
                              }
                              <p class="admin-empty account-form__full">{{ t('replaceHint') }}</p>
                            }
                          </div>

                          <div class="account-form__actions">
                            <button
                              class="btn btn--primary"
                              type="submit"
                              [disabled]="busy() === item.id"
                            >
                              {{
                                busy() === item.id
                                  ? t('working')
                                  : d.action === 'CREATE'
                                    ? t('publish')
                                    : t('replace')
                              }}
                            </button>
                            <button
                              class="btn btn--secondary"
                              type="button"
                              [disabled]="busy() === item.id"
                              (click)="retry(item)"
                            >
                              {{ t('regenerate') }}
                            </button>
                            <button
                              class="btn btn--ghost"
                              type="button"
                              [disabled]="busy() === item.id"
                              (click)="discard(item)"
                            >
                              {{ t('discard') }}
                            </button>
                          </div>
                        </form>
                      }
                    }
                  }
                </div>
              </article>
            }
          </div>
        }
      </section>
    </ng-container>
  `,
})
export class AiImportAdminPage {
  private readonly api = inject(AdminApiService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly views: readonly View[] = ['ACTIVE', 'PUBLISHED', 'DISCARDED'];
  readonly countOrder: readonly ImportStatus[] = [
    'QUEUED',
    'PROCESSING',
    'READY',
    'FAILED',
    'PUBLISHED',
  ];
  readonly industries = SECTORS;
  readonly unitLabels = [
    'piece',
    'gobelet',
    'barquette',
    'sachet',
    'boite',
    'rouleau',
    'bouteille',
    'paire',
    'feuille',
    'bol',
    'pot',
    'paille',
    'pique',
    'sac',
    'can',
  ] as const;

  readonly list = signal<ImportList | null>(null);
  readonly categories = signal<readonly AdminCategory[]>([]);
  readonly brands = signal<readonly AdminBrand[]>([]);
  readonly uploads = signal<readonly UploadRow[]>([]);
  readonly view = signal<View>('ACTIVE');
  readonly loading = signal(true);
  readonly dragging = signal(false);
  readonly busy = signal<string | null>(null);
  readonly priceLists = signal<readonly PriceList[]>([]);
  readonly priceListBusy = signal(false);
  readonly error = signal('');
  readonly uploadsDone = computed(
    () => this.uploads().filter((row) => row.state === 'done').length,
  );

  private readonly drafts = new Map<string, Draft>();
  private uploadKey = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
    if (this.browser) void this.init();
  }

  private async init(): Promise<void> {
    try {
      const [categories, brands] = await Promise.all([this.api.categories(), this.api.brands()]);
      this.categories.set(categories);
      this.brands.set(brands);
    } catch {
      this.error.set('Les catégories et marques n’ont pas pu être chargées.');
    }
    await Promise.all([this.refresh(), this.loadPriceLists()]);
  }

  async refresh(): Promise<void> {
    this.stopPolling();
    try {
      const data = await this.api.imports(this.view() === 'ACTIVE' ? 'ACTIVE' : this.view());
      this.list.set(data);
      // Forget drafts of items that left the list (published, discarded, regenerated).
      const ready = new Set(data.items.filter((i) => i.status === 'READY').map((i) => i.id));
      for (const id of this.drafts.keys()) if (!ready.has(id)) this.drafts.delete(id);
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
    const counts = this.list()?.counts;
    const working = (counts?.QUEUED ?? 0) + (counts?.PROCESSING ?? 0) > 0;
    const uploading = this.uploads().some(
      (row) => row.state === 'waiting' || row.state === 'uploading',
    );
    if (this.browser && (working || uploading))
      this.timer = setTimeout(() => void this.refresh(), POLL_MS);
  }

  setView(view: View): void {
    this.view.set(view);
    this.loading.set(true);
    void this.refresh();
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.enqueue(Array.from(input.files ?? []));
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.list()?.configured) return;
    this.enqueue(Array.from(event.dataTransfer?.files ?? []));
  }

  /** Uploads a few files at a time; the server queues each one for the model as it lands. */
  private enqueue(files: File[]): void {
    const images = files.filter((file) => ACCEPTED.includes(file.type));
    if (!images.length) return;
    const rows: UploadRow[] = images.map((file) => ({
      key: ++this.uploadKey,
      name: file.name,
      state: 'waiting',
    }));
    this.uploads.update((current) => [...current, ...rows]);
    const queue = images.map((file, index) => ({ file, row: rows[index]! }));
    const next = async (): Promise<void> => {
      const job = queue.shift();
      if (!job) return;
      this.mark(job.row, 'uploading');
      try {
        await this.api.uploadImport(job.file);
        this.mark(job.row, 'done');
      } catch (error) {
        this.mark(job.row, 'error', this.message(error));
      }
      await next();
    };
    void Promise.all(Array.from({ length: UPLOAD_PARALLEL }, () => next())).then(() =>
      this.refresh(),
    );
    void this.refresh();
  }

  private mark(row: UploadRow, state: UploadRow['state'], error?: string): void {
    row.state = state;
    row.error = error;
    this.uploads.update((rows) => [...rows]);
  }

  async loadPriceLists(): Promise<void> {
    try {
      this.priceLists.set(await this.api.priceLists());
    } catch {
      // Shown as "no list loaded"; the importer still works without prices.
    }
  }

  /** Uploads PDFs one at a time; each replaces the earlier edition of the same list. */
  async onPickPriceLists(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    this.priceListBusy.set(true);
    this.error.set('');
    try {
      for (const file of files) this.priceLists.set(await this.api.uploadPriceList(file));
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.priceListBusy.set(false);
    }
  }

  draftFor(item: ImportItem): Draft {
    let draft = this.drafts.get(item.id);
    if (!draft) {
      draft = {
        action: item.action ?? 'CREATE',
        matchedProductId: item.matchedProductId,
        nameFr: item.nameFr ?? '',
        nameEn: item.nameEn ?? '',
        shortDescriptionFr: item.shortDescriptionFr ?? '',
        shortDescriptionEn: item.shortDescriptionEn ?? '',
        descriptionFr: item.descriptionFr ?? '',
        descriptionEn: item.descriptionEn ?? '',
        categoryId: item.categoryId ?? '',
        subcategoryId: item.subcategoryId ?? '',
        brandId: item.brandId ?? '',
        industries: [...item.industries],
        formatValue: item.formatValue ?? '',
        packQuantity: item.packQuantity === null ? '' : String(item.packQuantity),
        unitLabel: item.unitLabel ?? 'piece',
        // The price found in the company's price list, ready to publish.
        saleMode: item.suggestedSaleMode ?? (item.packQuantity !== null ? 'PACK_ONLY' : 'UNIT'),
        price:
          item.suggestedSaleMode === 'UNIT' && item.suggestedPrice !== null
            ? item.suggestedPrice.toFixed(3)
            : '',
        unitPrice:
          item.suggestedSaleMode === 'PACK_ONLY' && item.suggestedPrice !== null
            ? item.suggestedPrice.toFixed(3)
            : '',
      };
      this.drafts.set(item.id, draft);
    }
    return draft;
  }

  subcategories(categoryId: string): readonly AdminCategory[] {
    return flattenSubcategories(this.categories().find((c) => c.externalId === categoryId));
  }

  toggleIndustry(draft: Draft, id: string): void {
    draft.industries = draft.industries.includes(id)
      ? draft.industries.filter((value) => value !== id)
      : [...draft.industries, id];
  }

  async publish(item: ImportItem): Promise<void> {
    const d = this.draftFor(item);
    const price = this.amount(d.price);
    const unitPrice = this.amount(d.unitPrice);
    const packQuantity = d.packQuantity.trim() ? Number(d.packQuantity) : null;
    if (d.action === 'CREATE') {
      if (!d.nameFr.trim() || !d.categoryId)
        return this.error.set('Le nom et la division sont obligatoires.');
      if (d.saleMode === 'UNIT' && price === null)
        return this.error.set('Saisissez un prix positif (au plus trois décimales).');
      if (d.saleMode === 'PACK_ONLY' && (unitPrice === null || !packQuantity || packQuantity < 1))
        return this.error.set(
          'Un produit vendu par lot demande un prix unitaire et un nombre de pièces.',
        );
    }
    this.busy.set(item.id);
    this.error.set('');
    try {
      await this.api.updateImport(item.id, {
        action: d.action,
        matchedProductId: d.action === 'REPLACE_IMAGE' ? d.matchedProductId : null,
        nameFr: d.nameFr.trim(),
        nameEn: this.text(d.nameEn),
        shortDescriptionFr: this.text(d.shortDescriptionFr),
        shortDescriptionEn: this.text(d.shortDescriptionEn),
        descriptionFr: this.text(d.descriptionFr),
        descriptionEn: this.text(d.descriptionEn),
        categoryId: d.categoryId,
        subcategoryId: this.text(d.subcategoryId),
        brandId: this.text(d.brandId),
        industries: d.industries,
        formatValue: this.text(d.formatValue),
        packQuantity: d.saleMode === 'PACK_ONLY' || packQuantity ? packQuantity : null,
        unitLabel: d.saleMode === 'PACK_ONLY' ? d.unitLabel : null,
      });
      // Replacing a photo leaves the price alone unless a new one is entered.
      const keepPrice =
        d.action === 'REPLACE_IMAGE' && (d.saleMode === 'PACK_ONLY' ? unitPrice : price) === null;
      await this.api.publishImport(item.id, {
        saleMode: keepPrice ? null : d.saleMode,
        price: !keepPrice && d.saleMode === 'UNIT' ? price : null,
        unitPrice: !keepPrice && d.saleMode === 'PACK_ONLY' ? unitPrice : null,
      });
      this.drafts.delete(item.id);
      await this.refresh();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(null);
    }
  }

  async retry(item: ImportItem): Promise<void> {
    this.busy.set(item.id);
    try {
      await this.api.retryImport(item.id);
      this.drafts.delete(item.id);
      await this.refresh();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(null);
    }
  }

  async discard(item: ImportItem): Promise<void> {
    if (!window.confirm(`Écarter « ${item.nameFr || item.originalFilename} » ?`)) return;
    this.busy.set(item.id);
    try {
      await this.api.discardImport(item.id);
      await this.refresh();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(null);
    }
  }

  private amount(value: string): number | null {
    const text = value.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
    const number = Number(text);
    return number > 0 ? number : null;
  }

  private text(value: string): string | null {
    return value.trim() ? value.trim() : null;
  }

  private message(error: unknown): string {
    const body = (error as { error?: { message?: string; code?: string } })?.error;
    return body?.message || body?.code || 'L’opération n’a pas abouti.';
  }

  private stopPolling(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
