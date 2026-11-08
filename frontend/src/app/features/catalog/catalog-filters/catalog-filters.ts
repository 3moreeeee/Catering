import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { A11yModule } from '@angular/cdk/a11y';
import { CatalogStore } from '../catalog.store';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { FacetValue } from '../../../shared/models/catalog.model';

interface FacetGroup {
  readonly key: string;
  readonly labelKey: string;
  readonly values: readonly FacetValue[];
}

/** Facet rows shown before "show more". */
const COLLAPSED_FACETS = 7;

/**
 * Faceted filters. Divisions are chosen in the aisle strip above, not here.
 *
 * A full-height drawer with a focus trap and an explicit close, so the result
 * list never re-flows while the visitor is choosing. Product families are
 * chosen on the page itself, in the shelf above the results.
 *
 * Each facet is a real `<input type="checkbox">` inside a `<fieldset>` with a
 * `<legend>` — screen readers get the grouping for free, and it works before
 * hydration.
 */
@Component({
  selector: 'fk-catalog-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, LocalizedTextPipe, A11yModule],
  template: `
    <ng-container *transloco="let t">
      <div
        class="filters"
        id="fk-catalog-filters"
        [class.is-open]="open()"
        [attr.role]="open() ? 'dialog' : null"
        [attr.aria-modal]="open() ? 'true' : null"
        [attr.aria-label]="t('catalog.filters')"
        [cdkTrapFocus]="open()"
        [cdkTrapFocusAutoCapture]="open()"
        [attr.inert]="inertWhenClosed()"
      >
        <div class="filters__head">
          <h2 class="filters__title">{{ t('catalog.filters') }}</h2>
          <button
            type="button"
            class="btn btn--icon filters__close"
            [attr.aria-label]="t('catalog.closeFilters')"
            (click)="dismiss.emit()"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M2 2l12 12M14 2L2 14"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <div class="filters__body">
          @for (group of visibleGroups(); track group.key) {
            <details class="filters__group" open>
              <summary>{{ t(group.labelKey) }}</summary>
              <fieldset>
                <legend class="u-visually-hidden">{{ t(group.labelKey) }}</legend>
                <ul>
                  @for (facet of shownValues(group); track facet.id) {
                    <li>
                      <label class="checkbox">
                        <input
                          type="checkbox"
                          [checked]="isChecked(group.key, facet.id)"
                          (change)="store().toggle(group.key, facet.id)"
                        />
                        <span class="checkbox__text">{{ facet.label | localized }}</span>
                        <span class="filters__count u-nums">{{ facet.count }}</span>
                      </label>
                    </li>
                  }
                </ul>
                @if (hiddenCount(group); as count) {
                  <button type="button" class="filters__more" (click)="showAll(group.key)">
                    {{ t('catalog.showMore', { count }) }}
                  </button>
                }
              </fieldset>
            </details>
          }
        </div>

        <div class="filters__foot">
          @if (store().hasActiveFilters()) {
            <button type="button" class="btn btn--ghost btn--sm" (click)="store().clearAll()">
              {{ t('catalog.clearAll') }}
            </button>
          }
          <button type="button" class="btn btn--primary filters__apply" (click)="dismiss.emit()">
            {{ t('catalog.applyFilters', { count: store().total() }) }}
          </button>
        </div>
      </div>

      @if (open()) {
        <div class="filters__backdrop" aria-hidden="true" (click)="dismiss.emit()"></div>
      }
    </ng-container>
  `,
  styleUrl: './catalog-filters.scss',
})
export class CatalogFilters {
  readonly store = input.required<CatalogStore>();
  readonly open = input(false);
  readonly dismiss = output<void>();

  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  /** Long lists start short; one with a selection shows everything, so it stays visible. */
  shownValues(group: FacetGroup): readonly FacetValue[] {
    return this.expanded().has(group.key) || this.hasActive(group.key)
      ? group.values
      : group.values.slice(0, COLLAPSED_FACETS);
  }

  hiddenCount(group: FacetGroup): number {
    return group.values.length - this.shownValues(group).length;
  }

  showAll(key: string): void {
    this.expanded.update((keys) => new Set(keys).add(key));
  }

  visibleGroups(): readonly FacetGroup[] {
    return this.groups().filter((group) => group.values.length > 0);
  }

  groups(): readonly FacetGroup[] {
    const facets = this.store().facets();
    return [
      { key: 'brand', labelKey: 'catalog.facet.brands', values: facets.brands },
      { key: 'industry', labelKey: 'catalog.facet.industries', values: facets.industries },
      { key: 'size', labelKey: 'catalog.facet.sizes', values: facets.sizes },
    ];
  }

  /** The drawer stays in the DOM to animate; closed, it must be out of the tab order. */
  inertWhenClosed(): true | null {
    return this.open() ? null : true;
  }

  hasActive(key: string): boolean {
    return this.selected(key).length > 0;
  }

  isChecked(key: string, id: string): boolean {
    return this.selected(key).includes(id);
  }

  private selected(key: string): readonly string[] {
    const query = this.store().query();
    const map: Record<string, readonly string[] | undefined> = {
      category: query.categories,
      sub: query.subcategories,
      brand: query.brands,
      industry: query.industries,
      size: query.sizes,
    };
    return map[key] ?? [];
  }
}
