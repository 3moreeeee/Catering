import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AdminApiService, CategoryCount, DashboardStats } from '../../core/admin/admin-api.service';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';

/** A division bar, already resolved to the reading language and to a bar width. */
interface CategoryBar {
  readonly id: string;
  readonly label: string;
  readonly products: number;
  readonly percent: number;
}

/** One pipeline stage. `percent` is the bar width, not a share of the total. */
interface PipelineStage {
  readonly status: string;
  readonly count: number;
  readonly percent: number;
  readonly step: number;
}

/**
 * Back-office overview.
 *
 * <p>Counts only what the system holds. There is deliberately no revenue tile:
 * the site takes no payment, and summing quote totals would present requests for
 * an offer as if they were sales. For the same reason no tile carries a trend
 * arrow — the database keeps no history to compare against, and a fabricated
 * "+12%" would be read as a measurement.
 *
 * <p>Chart colour follows the data's job. The division bars are nominal, so they
 * share one hue rather than a ramp, which would double-encode length as colour.
 * The pipeline is genuinely ordered, so it uses a validated four-step ordinal
 * ramp of the same hue. Every chart has a table twin behind a disclosure, so no
 * value is reachable only by colour or only by hover.
 */
@Component({
  selector: 'fk-admin-overview-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      @if (error()) {
        <p class="account-status is-error" role="alert">{{ t('dashboard.loadError') }}</p>
      }
      @if (stats(); as s) {
        <div class="dash-kpis">
          <a
            class="dash-kpi dash-kpi--lead"
            [routerLink]="to('admin/quotes')"
            [queryParams]="{ status: 'SUBMITTED' }"
          >
            <span class="dash-kpi__label">{{ t('dashboard.stats.newQuotes') }}</span>
            <strong class="dash-kpi__value">{{ s.quotesSubmitted }}</strong>
            <span class="dash-kpi__hint">{{
              t('dashboard.stats.inReview', { count: s.quotesInReview })
            }}</span>
          </a>
          <a class="dash-kpi" [routerLink]="to('admin/products')">
            <span class="dash-kpi__label">{{ t('dashboard.stats.products') }}</span>
            <strong class="dash-kpi__value">{{ s.activeProducts }}</strong>
            <span class="dash-kpi__hint">{{
              t('dashboard.stats.inactive', { count: s.inactiveProducts })
            }}</span>
          </a>
          <a class="dash-kpi" [routerLink]="to('admin/products')" [queryParams]="{ priced: 'no' }">
            <span class="dash-kpi__label">{{ t('dashboard.stats.unpriced') }}</span>
            <strong class="dash-kpi__value">{{ s.unpricedActiveProducts }}</strong>
            <span class="dash-kpi__hint">{{
              t('dashboard.stats.priced', { count: s.pricedProducts })
            }}</span>
          </a>
          <a class="dash-kpi" [routerLink]="to('admin/users')">
            <span class="dash-kpi__label">{{ t('dashboard.stats.clients') }}</span>
            <strong class="dash-kpi__value">{{ s.clients }}</strong>
            <span class="dash-kpi__hint">{{
              t('dashboard.stats.admins', { count: s.administrators })
            }}</span>
          </a>
          <a class="dash-kpi" [routerLink]="to('admin/offers')">
            <span class="dash-kpi__label">{{ t('dashboard.stats.offers') }}</span>
            <strong class="dash-kpi__value">{{ s.configuredOffers }}</strong>
            <span class="dash-kpi__hint">{{ t('dashboard.stats.manageOffers') }}</span>
          </a>
        </div>

        <div class="dash-grid">
          <div class="dash-grid__main">
            <!-- Quote activity over the trailing month. -->
            <section class="dash-card">
              <div class="dash-card__head">
                <div>
                  <p class="u-eyebrow">{{ t('dashboard.charts.activityHint') }}</p>
                  <h2>{{ t('dashboard.charts.activity') }}</h2>
                </div>
                <a class="btn btn--secondary btn--sm" [routerLink]="to('admin/quotes')">{{
                  t('dashboard.seeAll')
                }}</a>
              </div>

              @if (activityTotal() === 0) {
                <p class="dash-empty">{{ t('dashboard.charts.activityEmpty') }}</p>
              } @else {
                <figure class="dash-figure">
                  <svg
                    class="dash-spark"
                    [attr.viewBox]="'0 0 ' + sparkWidth + ' ' + sparkHeight"
                    preserveAspectRatio="none"
                    role="img"
                    [attr.aria-label]="
                      t('dashboard.charts.activityAria', {
                        count: activityTotal(),
                        days: s.quotesByDay.length,
                      })
                    "
                  >
                    <line
                      class="dash-spark__base"
                      [attr.x1]="0"
                      [attr.y1]="sparkHeight - 1"
                      [attr.x2]="sparkWidth"
                      [attr.y2]="sparkHeight - 1"
                    />
                    <path class="dash-spark__area" [attr.d]="sparkArea()" />
                    <path class="dash-spark__line" [attr.d]="sparkLine()" />
                  </svg>
                  <figcaption class="dash-axis">
                    <span>{{ firstDay() }}</span
                    ><span>{{ lastDay() }}</span>
                  </figcaption>
                </figure>
                <details class="dash-table-toggle">
                  <summary>{{ t('dashboard.charts.showTable') }}</summary>
                  <div class="admin-table-wrap">
                    <table class="admin-table">
                      <thead>
                        <tr>
                          <th>{{ t('dashboard.charts.day') }}</th>
                          <th>{{ t('dashboard.charts.requests') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (day of activeDays(); track day.day) {
                          <tr>
                            <td class="u-nums">{{ day.day }}</td>
                            <td class="u-nums">{{ day.quotes }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </details>
              }
            </section>

            <!-- Catalogue composition: nominal divisions, so a single hue. -->
            <section class="dash-card">
              <div class="dash-card__head">
                <div>
                  <p class="u-eyebrow">
                    {{
                      t('dashboard.charts.catalogueHint', {
                        count: s.activeProducts,
                        divisions: s.catalogueByCategory.length,
                      })
                    }}
                  </p>
                  <h2>{{ t('dashboard.charts.catalogue') }}</h2>
                </div>
                <a class="btn btn--secondary btn--sm" [routerLink]="to('admin/products')">{{
                  t('dashboard.seeAll')
                }}</a>
              </div>
              @if (categoryBars().length === 0) {
                <p class="dash-empty">{{ t('dashboard.products.empty') }}</p>
              } @else {
                <ul class="dash-bars">
                  @for (bar of categoryBars(); track bar.id) {
                    <li class="dash-bars__row">
                      <span class="dash-bars__label" [title]="bar.label">{{ bar.label }}</span>
                      <span class="dash-bars__track">
                        <span class="dash-bars__fill" [style.width.%]="bar.percent"></span>
                      </span>
                      <strong class="dash-bars__value u-nums">{{ bar.products }}</strong>
                    </li>
                  }
                </ul>
                <details class="dash-table-toggle">
                  <summary>{{ t('dashboard.charts.showTable') }}</summary>
                  <div class="admin-table-wrap">
                    <table class="admin-table">
                      <thead>
                        <tr>
                          <th>{{ t('dashboard.charts.division') }}</th>
                          <th>{{ t('dashboard.charts.products') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of s.catalogueByCategory; track row.categoryId) {
                          <tr>
                            <td>{{ name(row) }}</td>
                            <td class="u-nums">{{ row.products }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </details>
              }
            </section>
          </div>

          <div class="dash-grid__side">
            <!-- Where the request pipeline currently stands. -->
            <section class="dash-card">
              <div class="dash-card__head">
                <div>
                  <p class="u-eyebrow">{{ t('dashboard.pipeline.eyebrow') }}</p>
                  <h2>{{ t('dashboard.pipeline.title') }}</h2>
                </div>
              </div>
              @if (pipelineTotal() === 0) {
                <p class="dash-empty">{{ t('dashboard.quotes.empty') }}</p>
              } @else {
                <ul class="dash-funnel">
                  @for (stage of pipeline(); track stage.status) {
                    <li class="dash-funnel__row">
                      <span class="dash-funnel__label">{{
                        t('dashboard.quoteStatus.' + stage.status)
                      }}</span>
                      <span class="dash-funnel__track">
                        <span
                          class="dash-funnel__fill"
                          [attr.data-step]="stage.step"
                          [style.width.%]="stage.percent"
                        ></span>
                      </span>
                      <strong class="dash-funnel__value u-nums">{{ stage.count }}</strong>
                    </li>
                  }
                </ul>
              }
            </section>

            <!-- Shortcuts to the tasks this screen most often leads to. -->
            <section class="dash-card dash-quick">
              <div class="dash-card__head">
                <div>
                  <p class="u-eyebrow">{{ t('dashboard.quick.eyebrow') }}</p>
                  <h2>{{ t('dashboard.quick.title') }}</h2>
                </div>
              </div>
              <a class="dash-quick__item" [routerLink]="to('admin/products')">
                <span class="dash-quick__icon" aria-hidden="true">+</span>
                <span
                  >{{ t('dashboard.products.create')
                  }}<small>{{ t('dashboard.quick.productHint') }}</small></span
                >
              </a>
              <a class="dash-quick__item" [routerLink]="to('admin/offers')">
                <span class="dash-quick__icon" aria-hidden="true">%</span>
                <span
                  >{{ t('dashboard.offers.create')
                  }}<small>{{ t('dashboard.quick.offerHint') }}</small></span
                >
              </a>
              <a class="dash-quick__item" [routerLink]="to('admin/users')">
                <span class="dash-quick__icon" aria-hidden="true">+</span>
                <span
                  >{{ t('admin.create') }}<small>{{ t('dashboard.quick.userHint') }}</small></span
                >
              </a>
            </section>
          </div>
        </div>

        <section class="dash-card">
          <div class="dash-card__head">
            <h2>{{ t('dashboard.recentQuotes') }}</h2>
            <a class="btn btn--secondary btn--sm" [routerLink]="to('admin/quotes')">{{
              t('dashboard.seeAll')
            }}</a>
          </div>
          @if (s.recentQuotes.length === 0) {
            <p class="dash-empty">{{ t('dashboard.quotes.empty') }}</p>
          } @else {
            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>{{ t('dashboard.quotes.reference') }}</th>
                    <th>{{ t('dashboard.quotes.client') }}</th>
                    <th>{{ t('dashboard.quotes.date') }}</th>
                    <th>{{ t('dashboard.quotes.total') }}</th>
                    <th>{{ t('dashboard.quotes.status') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (quote of s.recentQuotes; track quote.id) {
                    <tr>
                      <td>
                        <strong class="u-nums">{{ quote.reference }}</strong>
                      </td>
                      <td>
                        <span class="admin-person"
                          ><strong>{{
                            quote.companyName || quote.contactName || quote.contactEmail
                          }}</strong
                          ><small>{{ quote.contactEmail }}</small></span
                        >
                      </td>
                      <td class="u-nums">{{ quote.createdAt.slice(0, 10) }}</td>
                      <td class="u-nums">
                        {{
                          quote.totalAmount === null ? '—' : quote.totalAmount.toFixed(3) + ' TND'
                        }}
                      </td>
                      <td>
                        <span class="admin-badge" [attr.data-status]="quote.status">{{
                          t('dashboard.quoteStatus.' + quote.status)
                        }}</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      } @else if (!error()) {
        <p class="dash-empty">{{ t('common.loading') }}</p>
      }
    </ng-container>
  `,
})
export class AdminOverviewPage {
  private readonly api = inject(AdminApiService);
  private readonly links = inject(LocalizedRouter);
  private readonly transloco = inject(TranslocoService);

  /** Division names arrive bilingual; the chart shows the reading language. */
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly stats = signal<DashboardStats | null>(null);
  readonly error = signal(false);

  /** The sparkline is drawn in its own coordinate space and scaled by CSS. */
  readonly sparkWidth = 600;
  readonly sparkHeight = 120;

  /** Longest tail kept as its own bar before the rest is folded into "other". */
  private static readonly MAX_BARS = 8;

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this.api.stats().then(
        (stats) => this.stats.set(stats),
        () => this.error.set(true),
      );
    }
  }

  to(path: string): string[] {
    return this.links.path(path);
  }

  name(row: CategoryCount): string {
    return (this.lang() === 'en' ? (row.name.en ?? row.name.fr) : row.name.fr) || row.categoryId;
  }

  /**
   * Top divisions by product count, with the remainder folded into one bar.
   *
   * Widths are a share of the largest division rather than of the catalogue, so
   * the smaller divisions stay legible instead of collapsing into slivers.
   */
  readonly categoryBars = computed<readonly CategoryBar[]>(() => {
    const rows = this.stats()?.catalogueByCategory ?? [];
    if (rows.length === 0) return [];
    const head = rows.slice(0, AdminOverviewPage.MAX_BARS);
    const tail = rows.slice(AdminOverviewPage.MAX_BARS);
    const tailTotal = tail.reduce((sum, row) => sum + row.products, 0);
    const max = Math.max(...head.map((row) => row.products), tailTotal, 1);
    const bars: CategoryBar[] = head.map((row) => ({
      id: row.categoryId,
      label: this.name(row),
      products: row.products,
      percent: Math.max(2, (row.products / max) * 100),
    }));
    if (tailTotal > 0) {
      bars.push({
        id: '__other__',
        label: this.transloco.translate('dashboard.charts.others', { count: tail.length }),
        products: tailTotal,
        percent: Math.max(2, (tailTotal / max) * 100),
      });
    }
    return bars;
  });

  readonly pipelineTotal = computed(() => {
    const s = this.stats();
    return s ? s.quotesSubmitted + s.quotesInReview + s.quotesAnswered + s.quotesClosed : 0;
  });

  readonly pipeline = computed<readonly PipelineStage[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const values = [
      { status: 'SUBMITTED', count: s.quotesSubmitted },
      { status: 'IN_REVIEW', count: s.quotesInReview },
      { status: 'ANSWERED', count: s.quotesAnswered },
      { status: 'CLOSED', count: s.quotesClosed },
    ];
    const max = Math.max(1, ...values.map((item) => item.count));
    return values.map((item, index) => ({
      ...item,
      step: index + 1,
      percent: item.count === 0 ? 0 : Math.max(4, (item.count / max) * 100),
    }));
  });

  readonly activityTotal = computed(() =>
    (this.stats()?.quotesByDay ?? []).reduce((sum, day) => sum + day.quotes, 0),
  );

  /** Only the days that saw a request; the table is a reading aid, not a log. */
  readonly activeDays = computed(() =>
    (this.stats()?.quotesByDay ?? []).filter((day) => day.quotes > 0),
  );

  firstDay(): string {
    return this.stats()?.quotesByDay[0]?.day ?? '';
  }

  lastDay(): string {
    const days = this.stats()?.quotesByDay ?? [];
    return days[days.length - 1]?.day ?? '';
  }

  sparkLine(): string {
    return this.sparkPoints()
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
      .join(' ');
  }

  sparkArea(): string {
    const points = this.sparkPoints();
    // Bound rather than indexed inline: the project compiles with
    // noUncheckedIndexedAccess, so an index yields `T | undefined`.
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return '';
    const base = this.sparkHeight - 1;
    return `M${first.x} ${base} ${points
      .map((point) => `L${point.x} ${point.y}`)
      .join(' ')} L${last.x} ${base} Z`;
  }

  private sparkPoints(): readonly { x: number; y: number }[] {
    const days = this.stats()?.quotesByDay ?? [];
    if (days.length === 0) return [];
    const max = Math.max(1, ...days.map((day) => day.quotes));
    const step = days.length > 1 ? this.sparkWidth / (days.length - 1) : 0;
    // Two units of headroom keep a peak's 2px stroke inside the viewBox.
    const usable = this.sparkHeight - 4;
    return days.map((day, index) => ({
      x: Math.round(index * step),
      y: Math.round(this.sparkHeight - 2 - (day.quotes / max) * usable),
    }));
  }
}
