import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import {
  CATEGORY_REPOSITORY,
  INDUSTRY_REPOSITORY,
} from '../../../data/repositories/catalog.repository';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { Category, CategoryId, Industry, IndustryId } from '../../../shared/models/catalog.model';
import { LocalizedText } from '../../../shared/models/localized-text.model';

/**
 * The pivot: from what the company sells to what the visitor does.
 *
 * A professional buyer does not arrive knowing a SKU. A pastry counter, a
 * hospital kitchen and a packaging line all draw on this catalogue, and they
 * draw on completely different parts of it. This is the one place on the page
 * where the visitor is asked to identify themselves rather than to browse, and
 * it is the strongest thing this site has that a conventional shop does not.
 *
 * It is deliberately **not** six cards. Six cards say "here are six sectors";
 * an index says "find yourself in this list". The sectors are set as a
 * contents page in display type, and choosing one opens the company's real
 * account of how it supplies that sector — the same verified copy the sector
 * page carries, not a summary written for a tile.
 *
 * Nothing here is invented. `howWeSupport` is the company's own description of
 * its range for that sector, the division links are generated from
 * `relevantCategories`, and a sector the company has not itself named carries a
 * visible marker rather than an implied client relationship.
 *
 * The control is a real vertical tablist — roving tabindex, arrow keys,
 * Home/End — so the whole module is operable from the keyboard and announces
 * itself correctly. On narrow screens the list stacks above its panel; the
 * semantics do not change.
 */
@Component({
  selector: 'fk-sector-index',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe],
  template: `
    <ng-container *transloco="let t">
      <div class="container--wide sector__inner">
        <header class="sector__head">
          <p class="u-eyebrow">{{ t('home.industries.eyebrow') }}</p>
          <h2 class="sector__title">{{ t('home.sectors.title') }}</h2>
          <p class="sector__lead">{{ t('home.industries.lead') }}</p>
        </header>

        <div class="sector__body">
          <div
            class="sector__list"
            role="tablist"
            aria-orientation="vertical"
            [attr.aria-label]="t('home.sectors.listLabel')"
          >
            @for (industry of industries(); track industry.id; let i = $index) {
              <button
                type="button"
                role="tab"
                class="sector__row"
                [id]="'sector-tab-' + industry.id"
                [attr.aria-selected]="active() === industry.id"
                [attr.aria-controls]="'sector-panel-' + industry.id"
                [attr.tabindex]="active() === industry.id ? 0 : -1"
                [class.is-active]="active() === industry.id"
                (click)="active.set(industry.id)"
                (keydown)="onKeydown($event)"
              >
                <span class="sector__num u-nums" aria-hidden="true">{{ ordinal(i) }}</span>
                <span class="sector__name">{{ industry.name | localized }}</span>
              </button>
            }
          </div>

          @for (industry of industries(); track industry.id) {
            <div
              class="sector__panel"
              role="tabpanel"
              [id]="'sector-panel-' + industry.id"
              [attr.aria-labelledby]="'sector-tab-' + industry.id"
              [hidden]="active() !== industry.id"
              tabindex="0"
            >
              <p class="sector__scope">{{ industry.description | localized }}</p>
              <p class="sector__support">{{ industry.howWeSupport | localized }}</p>

              <p class="u-label sector__draws">{{ t('home.sectors.draws') }}</p>
              <ul class="sector__divisions">
                @for (categoryId of industry.relevantCategories; track categoryId) {
                  <li>
                    <a
                      class="sector__division"
                      [style.--cat-accent]="accentFor(categoryId)"
                      [routerLink]="to('products/' + slugFor(categoryId))"
                      [queryParams]="{ industry: industry.id }"
                    >
                      <span class="sector__division-dot" aria-hidden="true"></span>
                      {{ nameFor(categoryId) | localized }}
                    </a>
                  </li>
                }
              </ul>

              <div class="sector__actions">
                <a
                  class="link link--accent"
                  [routerLink]="to('industries')"
                  [fragment]="industry.slug"
                >
                  {{ t('home.industries.learnMore') }}
                  <span class="link__arrow" aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          }
        </div>
      </div>
    </ng-container>
  `,
  styleUrl: './sector-index.scss',
})
export class SectorIndex {
  private readonly links = inject(LocalizedRouter);
  private readonly industryRepo = inject(INDUSTRY_REPOSITORY);
  private readonly categoryRepo = inject(CATEGORY_REPOSITORY);

  readonly industries = toSignal(this.industryRepo.all(), {
    initialValue: [] as readonly Industry[],
  });
  private readonly categories = toSignal(this.categoryRepo.all(), { initialValue: [] });

  /**
   * Restauration opens the index. It is the sector the founder names first, and
   * the one the largest part of the catalogue is bought by.
   */
  readonly active = signal<IndustryId>('restaurants');

  private readonly ids = computed(() => this.industries().map((industry) => industry.id));

  ordinal(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  slugFor(id: CategoryId): string {
    return this.categoryFor(id)?.slug ?? 'products';
  }

  nameFor(id: CategoryId): LocalizedText {
    return this.categoryFor(id)?.shortName ?? { en: '', fr: '' };
  }

  accentFor(id: CategoryId): string {
    return this.categoryFor(id)?.accent ?? 'currentColor';
  }

  private categoryFor(id: CategoryId): Category | undefined {
    return this.categories().find((category) => category.id === id);
  }

  to(path: string): string[] {
    return this.links.path(path);
  }

  /** Vertical tablist navigation, as the WAI-ARIA pattern requires. */
  onKeydown(event: KeyboardEvent): void {
    const ids = this.ids();
    const current = ids.indexOf(this.active());
    if (current === -1) {
      return;
    }

    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = (current + 1) % ids.length;
        break;
      case 'ArrowUp':
        next = (current - 1 + ids.length) % ids.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = ids.length - 1;
        break;
      default:
        return;
    }

    const id = ids[next];
    if (id) {
      event.preventDefault();
      this.active.set(id);
      const tab = event.currentTarget as HTMLElement;
      tab
        .closest('[role="tablist"]')
        ?.querySelector<HTMLButtonElement>(`#sector-tab-${id}`)
        ?.focus();
    }
  }
}
