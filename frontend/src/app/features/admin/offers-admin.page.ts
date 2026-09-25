import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { AdminApiService, AdminProduct, Page } from '../../core/admin/admin-api.service';
import { PricingService } from '../../core/cart/pricing.service';

@Component({
  selector: 'fk-offers-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      @if (error()) {
        <p class="account-status is-error" role="alert">{{ t('dashboard.errors.' + error()) }}</p>
      }
      @if (success()) {
        <p class="account-status is-success" role="status">{{ t('dashboard.offers.saved') }}</p>
      }

      <section class="account-card">
        <div class="admin-section-head">
          <div>
            <h2>{{ t('dashboard.offers.create') }}</h2>
            <p class="admin-count">{{ t('dashboard.offers.lead') }}</p>
          </div>
        </div>
        <form class="account-form" (ngSubmit)="save()">
          <div class="account-form__grid">
            <label class="field account-form__full">
              <span class="field__label">{{ t('dashboard.products.searchProduct') }}</span>
              <span class="admin-offer-search"
                ><input
                  class="control"
                  name="candidateQuery"
                  [(ngModel)]="candidateQuery"
                  [placeholder]="t('dashboard.products.searchPlaceholder')"
                /><button class="btn btn--secondary" type="button" (click)="searchCandidates()">
                  {{ t('admin.searchAction') }}
                </button></span
              >
            </label>
            <label class="field account-form__full">
              <span class="field__label">{{ t('dashboard.offers.product') }}</span>
              <select
                class="control"
                name="productId"
                [(ngModel)]="draft.productId"
                required
                (change)="selectProduct()"
              >
                <option value="">{{ t('dashboard.products.choose') }}</option>
                @for (product of candidates(); track product.id) {
                  <option [value]="product.id" [disabled]="product.price === null">
                    {{ product.name.fr }} —
                    {{ product.price === null ? t('cart.priceOnRequest') : money(product.price) }}
                  </option>
                }
              </select>
            </label>
            <label class="field">
              <span class="field__label">{{ t('dashboard.offers.normalPrice') }}</span>
              <input
                class="control u-nums"
                [value]="
                  selected()?.price === null || selected()?.price === undefined
                    ? '—'
                    : money(selected()!.price!)
                "
                disabled
              />
            </label>
            <label class="field">
              <span class="field__label">{{ t('dashboard.offers.offerPrice') }}</span>
              <input
                class="control u-nums"
                name="offerPrice"
                [(ngModel)]="draft.offerPrice"
                inputmode="decimal"
                pattern="[0-9]+([.,][0-9]{1,3})?"
                required
              />
              @if (discountPreview() !== null) {
                <span class="admin-discount"
                  >−{{ discountPreview() }}% {{ t('dashboard.offers.discount') }}</span
                >
              }
            </label>
            <label class="field">
              <span class="field__label">{{ t('dashboard.offers.startsAt') }}</span>
              <input
                class="control"
                type="datetime-local"
                name="startsAt"
                [(ngModel)]="draft.startsAt"
              />
            </label>
            <label class="field">
              <span class="field__label">{{ t('dashboard.offers.endsAt') }}</span>
              <input
                class="control"
                type="datetime-local"
                name="endsAt"
                [(ngModel)]="draft.endsAt"
              />
            </label>
            <label class="field account-form__full">
              <span
                ><input type="checkbox" name="active" [(ngModel)]="draft.active" />
                {{ t('dashboard.offers.active') }}</span
              >
            </label>
          </div>
          <div class="account-form__actions">
            <button
              class="btn btn--primary"
              type="submit"
              [disabled]="saving() || !draft.productId || !draft.offerPrice"
            >
              {{ saving() ? t('common.loading') : t('admin.save') }}
            </button>
            @if (editing()) {
              <button class="btn btn--secondary" type="button" (click)="reset()">
                {{ t('common.cancel') }}
              </button>
            }
          </div>
        </form>
      </section>

      <section class="account-card">
        <div class="admin-section-head">
          <h2>{{ t('dashboard.offers.list') }}</h2>
        </div>
        @if (loading()) {
          <p class="admin-empty">{{ t('common.loading') }}</p>
        } @else if (!offers()?.items?.length) {
          <p class="admin-empty">{{ t('dashboard.offers.empty') }}</p>
        } @else {
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>{{ t('dashboard.offers.product') }}</th>
                  <th>{{ t('dashboard.offers.normalPrice') }}</th>
                  <th>{{ t('dashboard.offers.offerPrice') }}</th>
                  <th>{{ t('dashboard.offers.discount') }}</th>
                  <th>{{ t('dashboard.offers.period') }}</th>
                  <th>{{ t('dashboard.quotes.status') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (offer of offers()!.items; track offer.id) {
                  <tr>
                    <td>
                      <span class="admin-person"
                        ><strong>{{ offer.name.fr }}</strong
                        ><small>{{ offer.sourceId }}</small></span
                      >
                    </td>
                    <td class="u-nums">{{ offer.price === null ? '—' : money(offer.price) }}</td>
                    <td class="u-nums">
                      <strong>{{ money(offer.offerPrice!) }}</strong>
                    </td>
                    <td>
                      <span class="admin-discount">−{{ discountPercentage(offer) }}%</span>
                    </td>
                    <td class="u-nums">{{ period(offer) }}</td>
                    <td>
                      <span class="admin-badge" [attr.data-status]="offerStatus(offer)">{{
                        t('dashboard.offers.status.' + offerStatus(offer))
                      }}</span>
                    </td>
                    <td>
                      <div class="admin-actions">
                        <button
                          class="btn btn--secondary btn--sm"
                          type="button"
                          (click)="edit(offer)"
                        >
                          {{ t('admin.edit') }}</button
                        ><button
                          class="btn btn--ghost btn--sm"
                          type="button"
                          (click)="remove(offer)"
                        >
                          {{ t('admin.delete') }}
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </ng-container>
  `,
})
export class OffersAdminPage {
  private readonly api = inject(AdminApiService);
  private readonly pricing = inject(PricingService);
  readonly candidates = signal<readonly AdminProduct[]>([]);
  readonly offers = signal<Page<AdminProduct> | null>(null);
  readonly selected = signal<AdminProduct | null>(null);
  readonly editing = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal(false);
  draft = { productId: '', offerPrice: '', startsAt: '', endsAt: '', active: true };
  candidateQuery = '';

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [products, offers] = await Promise.all([
        this.api.products({ status: 'active', priced: 'yes', pageSize: 100 }),
        this.api.offers('', 0, 100),
      ]);
      this.candidates.set(products.items);
      this.offers.set(offers);
    } catch {
      this.error.set('unknown');
    } finally {
      this.loading.set(false);
    }
  }

  selectProduct(): void {
    this.selected.set(this.candidates().find((p) => p.id === this.draft.productId) ?? null);
  }

  async searchCandidates(): Promise<void> {
    try {
      const result = await this.api.products({
        q: this.candidateQuery,
        status: 'active',
        priced: 'yes',
        pageSize: 100,
      });
      this.candidates.set(result.items);
      this.draft.productId = '';
      this.selected.set(null);
    } catch {
      this.error.set('unknown');
    }
  }

  edit(product: AdminProduct): void {
    if (!this.candidates().some((item) => item.id === product.id))
      this.candidates.update((items) => [...items, product]);
    this.selected.set(product);
    this.editing.set(true);
    this.draft = {
      productId: product.id,
      offerPrice: String(product.offerPrice ?? ''),
      startsAt: this.local(product.offerStartsAt),
      endsAt: this.local(product.offerEndsAt),
      active: product.offerActive,
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async save(): Promise<void> {
    const price = Number(this.draft.offerPrice.replace(',', '.'));
    if (!this.draft.productId || !Number.isFinite(price) || price <= 0) {
      this.error.set('invalid_price');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.success.set(false);
    try {
      const sourceId = this.selected()?.sourceId;
      await this.api.saveOffer(this.draft.productId, {
        offerPrice: price,
        startsAt: this.iso(this.draft.startsAt),
        endsAt: this.iso(this.draft.endsAt),
        active: this.draft.active,
      });
      if (sourceId) this.pricing.invalidate(sourceId);
      this.success.set(true);
      this.reset();
      await this.load();
    } catch (error) {
      this.error.set(AdminApiService.errorCode(error));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(product: AdminProduct): Promise<void> {
    if (!window.confirm(`Supprimer l'offre « ${product.name.fr} » ?`)) return;
    try {
      await this.api.deleteOffer(product.id);
      this.pricing.invalidate(product.sourceId);
      await this.load();
    } catch (error) {
      this.error.set(AdminApiService.errorCode(error));
    }
  }

  reset(): void {
    this.draft = { productId: '', offerPrice: '', startsAt: '', endsAt: '', active: true };
    this.selected.set(null);
    this.editing.set(false);
  }
  money(value: number): string {
    return value.toFixed(3) + ' TND';
  }

  discountPreview(): number | null {
    const regular = this.selected()?.price;
    const offer = Number(this.draft.offerPrice.replace(',', '.'));
    return regular && Number.isFinite(offer) && offer > 0 && offer < regular
      ? this.discount(regular, offer)
      : null;
  }

  discountPercentage(product: AdminProduct): number {
    return this.discount(product.price ?? 0, product.offerPrice ?? 0);
  }

  offerStatus(product: AdminProduct): 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE' {
    if (!product.offerActive) return 'INACTIVE';
    if (product.offerCurrentlyActive) return 'ACTIVE';
    const now = Date.now();
    if (product.offerStartsAt && new Date(product.offerStartsAt).getTime() > now)
      return 'SCHEDULED';
    if (product.offerEndsAt && new Date(product.offerEndsAt).getTime() < now) return 'EXPIRED';
    return 'INACTIVE';
  }

  private discount(regular: number, offer: number): number {
    if (regular <= 0 || offer <= 0) return 0;
    return Math.round((1 - offer / regular) * 1000) / 10;
  }
  period(product: AdminProduct): string {
    return (
      [product.offerStartsAt?.slice(0, 10), product.offerEndsAt?.slice(0, 10)]
        .filter(Boolean)
        .join(' → ') || 'Permanent'
    );
  }
  private iso(value: string): string | null {
    return value ? new Date(value).toISOString() : null;
  }
  private local(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }
}
