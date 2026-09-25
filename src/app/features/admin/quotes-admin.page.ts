import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AdminApiService, Page } from '../../core/admin/admin-api.service';
import { Quote, QuoteStatus } from '../../core/cart/cart.models';

/**
 * The devis inbox: every panier a client has submitted.
 *
 * The lines shown are the snapshot frozen at submit time, not today's catalogue,
 * so the administrator answers exactly what the client was shown. A closed
 * request cannot be reopened; the API refuses it and the select offers only
 * "Clôturée" once there.
 */
@Component({
  selector: 'fk-quotes-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      @if (error()) {
        <p class="account-status is-error" role="alert">{{ t('dashboard.loadError') }}</p>
      }

      <div class="account-card">
        <div class="admin-toolbar">
          <div class="admin-filters">
            <label class="u-visually-hidden" for="q-status">{{ t('dashboard.quotes.status') }}</label>
            <select id="q-status" class="control" [(ngModel)]="status" (change)="load(0)">
              <option value="">{{ t('dashboard.quotes.allStatuses') }}</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ t('dashboard.quoteStatus.' + s) }}</option>
              }
            </select>
          </div>
        </div>

        @if (page(); as p) {
          @if (p.items.length === 0) {
            <p class="admin-empty">{{ t('dashboard.quotes.empty') }}</p>
          } @else {
            <ul class="admin-quotes">
              @for (quote of p.items; track quote.id) {
                <li class="admin-quote" [class.is-open]="openId() === quote.id">
                  <button
                    type="button"
                    class="admin-quote__summary"
                    [attr.aria-expanded]="openId() === quote.id"
                    (click)="toggle(quote)"
                  >
                    <span class="admin-person"
                      ><strong class="admin-quote__ref">{{ quote.reference }}</strong
                      ><small class="admin-quote__kind" [attr.data-kind]="quote.kind">{{
                        t('dashboard.quoteKind.' + quote.kind)
                      }}</small></span
                    >
                    <span class="admin-person"
                      ><strong>{{ quote.companyName || quote.contactName || quote.contactEmail }}</strong
                      ><small>{{ quote.contactEmail }}</small></span
                    >
                    <span class="u-nums">{{ quote.createdAt.slice(0, 10) }}</span>
                    <span class="u-nums admin-quote__total">{{ money(quote.totalAmount) }}</span>
                    <span class="admin-badge" [attr.data-status]="quote.status">{{
                      t('dashboard.quoteStatus.' + quote.status)
                    }}</span>
                  </button>

                  @if (openId() === quote.id) {
                    <div class="admin-quote__detail">
                      <dl class="admin-quote__contact">
                        <div><dt>{{ t('cart.fields.contactName') }}</dt><dd>{{ quote.contactName || '—' }}</dd></div>
                        <div><dt>{{ t('cart.fields.companyName') }}</dt><dd>{{ quote.companyName || '—' }}</dd></div>
                        <div><dt>{{ t('cart.fields.contactPhone') }}</dt><dd>{{ quote.contactPhone || '—' }}</dd></div>
                        <div><dt>{{ t('cart.fields.deliveryCity') }}</dt><dd>{{ quote.deliveryCity || '—' }}</dd></div>
                      </dl>
                      @if (quote.message) {
                        <p class="admin-quote__message">{{ quote.message }}</p>
                      }

                      <div class="admin-table-wrap">
                        <table class="admin-table">
                          <thead>
                            <tr>
                              <th>{{ t('dashboard.products.product') }}</th>
                              <th>{{ t('cart.quantity') }}</th>
                              <th>{{ t('dashboard.quotes.unitPrice') }}</th>
                              <th>{{ t('dashboard.quotes.total') }}</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (line of quote.lines; track line.id) {
                              <tr>
                                <td>
                                  <span class="admin-person"
                                    ><strong>{{ line.productName }}</strong
                                    ><small>{{ line.reference || line.productSourceId }}</small></span
                                  >
                                </td>
                                <td class="u-nums">{{ line.quantity }}</td>
                                <td class="u-nums">{{ money(line.unitPrice) }}</td>
                                <td class="u-nums">{{ money(line.lineTotal) }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                      @if (quote.hasUnpricedLines) {
                        <p class="admin-count">{{ t('dashboard.quotes.partial') }}</p>
                      }

                      <div class="admin-quote__workflow">
                        <div class="field">
                          <label class="field__label" [attr.for]="'st-' + quote.id">{{ t('dashboard.quotes.status') }}</label>
                          <select [id]="'st-' + quote.id" class="control" [(ngModel)]="draftStatus" [disabled]="quote.status === 'CLOSED'">
                            @for (s of statuses; track s) {
                              <option [value]="s">{{ t('dashboard.quoteStatus.' + s) }}</option>
                            }
                          </select>
                        </div>
                        <div class="field admin-quote__note">
                          <label class="field__label" [attr.for]="'note-' + quote.id">{{ t('dashboard.quotes.note') }}</label>
                          <textarea [id]="'note-' + quote.id" class="control" rows="2" [(ngModel)]="draftNote"></textarea>
                        </div>
                        <button class="btn btn--primary" type="button" [disabled]="saving()" (click)="save(quote)">
                          {{ saving() ? t('admin.saving') : t('admin.save') }}
                        </button>
                      </div>
                    </div>
                  }
                </li>
              }
            </ul>

            @if (p.totalPages > 1) {
              <nav class="admin-pager" [attr.aria-label]="t('common.pagination')">
                <button class="btn btn--secondary btn--sm" type="button" [disabled]="p.page === 0" (click)="load(p.page - 1)">
                  {{ t('common.previous') }}
                </button>
                <span class="u-nums">{{ t('common.pageOf', { current: p.page + 1, total: p.totalPages }) }}</span>
                <button class="btn btn--secondary btn--sm" type="button" [disabled]="p.page + 1 >= p.totalPages" (click)="load(p.page + 1)">
                  {{ t('common.next') }}
                </button>
              </nav>
            }
          }
        } @else if (!error()) {
          <p class="admin-empty">{{ t('common.loading') }}</p>
        }
      </div>
    </ng-container>
  `,
})
export class QuotesAdminPage {
  private readonly api = inject(AdminApiService);

  readonly statuses: readonly QuoteStatus[] = ['SUBMITTED', 'IN_REVIEW', 'ANSWERED', 'CLOSED'];
  readonly page = signal<Page<Quote> | null>(null);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly openId = signal<string | null>(null);

  status: QuoteStatus | '' = '';
  draftStatus: QuoteStatus = 'SUBMITTED';
  draftNote = '';

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const requested = inject(ActivatedRoute).snapshot.queryParamMap.get('status');
    if (requested && (this.statuses as readonly string[]).includes(requested)) {
      this.status = requested as QuoteStatus;
    }
    void this.load(0);
  }

  async load(pageIndex: number): Promise<void> {
    this.error.set(false);
    try {
      this.page.set(await this.api.quotes(this.status, pageIndex));
    } catch {
      this.error.set(true);
    }
  }

  toggle(quote: Quote): void {
    if (this.openId() === quote.id) {
      this.openId.set(null);
      return;
    }
    this.draftStatus = quote.status;
    this.draftNote = quote.adminNote ?? '';
    this.openId.set(quote.id);
  }

  async save(quote: Quote): Promise<void> {
    this.saving.set(true);
    try {
      const updated = await this.api.updateQuoteStatus(quote.id, this.draftStatus, this.draftNote || null);
      this.page.update((current) =>
        current
          ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) }
          : current,
      );
    } catch {
      this.error.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  money(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(3)} TND`;
  }
}
