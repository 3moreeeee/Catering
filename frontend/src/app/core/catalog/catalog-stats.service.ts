import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { PRODUCT_REPOSITORY } from '../../data/repositories/catalog.repository';
import { CategoryId, Subcategory } from '../../shared/models/catalog.model';

/**
 * Catalogue counters (total, per division, per brand) from one aggregate API
 * request shared by the header, the homepage and the brands page. Null while
 * unknown — on a prerendered page, or with the API unreachable — so templates
 * leave the number out rather than print a wrong one.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStats {
  private readonly stats = toSignal(inject(PRODUCT_REPOSITORY).stats(), { initialValue: null });

  readonly total = computed(() => this.stats()?.total ?? null);

  category(id: CategoryId): number | null {
    const stats = this.stats();
    return stats ? (stats.categories[id] ?? 0) : null;
  }

  /** Products in a category and its sub-categories; null while unknown. */
  subcategory(sub: Subcategory): number | null {
    const counts = this.stats()?.subcategories;
    if (!counts) return null;
    return (
      (counts[sub.id] ?? 0) +
      (sub.children ?? []).reduce((sum, child) => sum + (counts[child.id] ?? 0), 0)
    );
  }

  /**
   * Whether the menu should list a category: yes when it holds a product, and
   * also while counts are unknown, so a prerendered or offline menu is never
   * emptied.
   */
  hasProducts(sub: Subcategory): boolean {
    const count = this.subcategory(sub);
    return count === null || count > 0;
  }

  brand(id: string): number | null {
    const stats = this.stats();
    return stats ? (stats.brands[id] ?? 0) : null;
  }
}
