import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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

/**
 * Faceted filters.
 *
 * Desktop: a sticky sidebar, always visible, no dialog semantics.
 * Mobile: a full-height drawer with a focus trap and an explicit close, so the
 * result list never re-flows under the user's thumb while they are choosing.
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
          @for (group of groups(); track group.key) {
            @if (group.values.length) {
              <fieldset class="filters__group">
                <legend class="u-label">{{ t(group.labelKey) }}</legend>
                <ul>
                  @for (facet of group.values; track facet.id) {
                    <li>
                      <label class="checkbox" [attr.data-category]="group.key === 'category' ? facet.id : null">
                        <input
                          type="checkbox"
                          [checked]="isChecked(group.key, facet.id)"
                          (change)="store().toggle(group.key, facet.id)"
                        />
                        <span class="checkbox__text">
                          {{ facet.label | localized }}
                          <span class="filters__count u-nums">({{ facet.count }})</span>
                        </span>
                      </label>
                    </li>
                  }
                </ul>
              </fieldset>
            }
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

  groups(): readonly FacetGroup[] {
    const facets = this.store().facets();
    return [
      { key: 'category', labelKey: 'catalog.facet.categories', values: facets.categories },
      { key: 'sub', labelKey: 'catalog.facet.subcategories', values: facets.subcategories },
      { key: 'brand', labelKey: 'catalog.facet.brands', values: facets.brands },
      { key: 'industry', labelKey: 'catalog.facet.industries', values: facets.industries },
      { key: 'size', labelKey: 'catalog.facet.sizes', values: facets.sizes },
    ];
  }

  /**
   * On mobile the drawer stays in the DOM (translated off-canvas) so it can
   * animate. Without `inert`, its checkboxes remain in the tab order while the
   * drawer is closed — a keyboard user would tab into invisible controls.
   * Desktop shows the sidebar permanently, so it is never inert there.
   */
  inertWhenClosed(): true | null {
    return this.open() || this.isDesktop() ? null : true;
  }

  private isDesktop(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  }

  isChecked(key: string, id: string): boolean {
    const query = this.store().query();
    const map: Record<string, readonly string[] | undefined> = {
      category: query.categories,
      sub: query.subcategories,
      brand: query.brands,
      industry: query.industries,
      size: query.sizes,
    };
    return (map[key] ?? []).includes(id);
  }
}
