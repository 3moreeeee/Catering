import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { forkJoin, map } from 'rxjs';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { CATEGORIES } from '../../../data/categories.data';
import { PRODUCT_REPOSITORY } from '../../../data/repositories/catalog.repository';
import { CategoryId, Product } from '../../../shared/models/catalog.model';
import { LocalizedText } from '../../../shared/models/localized-text.model';
import { ProductCard } from '../../../shared/components/cards/product-card';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { CAMPAIGN_EXCLUDED_BRANDS } from './hero-slides';

/** Products shown per family: one row at desktop width. */
const PER_FAMILY = 4;

interface FamilyChoice {
  readonly id: string;
  readonly category: CategoryId;
  readonly label: LocalizedText;
}

/**
 * One family per division, each chosen because its products share one shape
 * (bottles of sauce, bottles of syrup, cups, workwear), so the four cards on
 * screen read alike instead of a ketchup beside a gastronorm tray.
 */
const FAMILIES: readonly FamilyChoice[] = [
  {
    id: 'sauces-dressings',
    category: 'food',
    label: { fr: 'Sauces et condiments', en: 'Sauces & condiments' },
  },
  { id: 'syrups', category: 'monin', label: { fr: 'Sirops MONIN', en: 'MONIN syrups' } },
  {
    id: 'cups-glasses',
    category: 'packaging',
    label: { fr: 'Verres et gobelets', en: 'Cups & glasses' },
  },
  {
    id: 'kitchen-wear',
    category: 'hygiene',
    label: { fr: 'Tenues et protection', en: 'Workwear & protection' },
  },
];

interface Family extends FamilyChoice {
  readonly products: readonly Product[];
  readonly total: number;
}

/**
 * "À découvrir dans le catalogue": one product family at a time, four of its
 * products side by side. The family chips and the arrows move between
 * families; the link under the row opens the whole family in the catalogue.
 */
@Component({
  selector: 'fk-featured-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, ProductCard, LocalizedTextPipe],
  templateUrl: './featured-section.html',
  styleUrl: './featured-section.scss',
})
export class FeaturedSection {
  private readonly links = inject(LocalizedRouter);
  private readonly productRepo = inject(PRODUCT_REPOSITORY);

  /** Families that came back with enough photographed products to fill a row. */
  readonly families = toSignal(
    forkJoin(
      FAMILIES.map((family) =>
        this.productRepo
          .list({
            categories: [family.category],
            subcategories: familyLeaves(family),
            sort: 'relevance',
            page: 1,
          })
          .pipe(
            map((page): Family => ({
              ...family,
              products: page.items
                .filter(
                  (p) =>
                    p.images.length > 0 && !(p.brandId && CAMPAIGN_EXCLUDED_BRANDS.has(p.brandId)),
                )
                .slice(0, PER_FAMILY),
              total: page.total,
            })),
          ),
      ),
    ).pipe(map((families): readonly Family[] => families.filter((f) => f.products.length > 0))),
    { initialValue: [] as readonly Family[] },
  );

  readonly active = signal(0);
  readonly current = computed(() => this.families()[this.active()] ?? null);

  select(index: number): void {
    const count = this.families().length;
    if (!count) return;
    this.active.set(((index % count) + count) % count);
  }

  familyLink(family: Family): string[] {
    const slug = CATEGORIES.find((c) => c.id === family.category)?.slug ?? family.category;
    return this.links.path(`products/${slug}`);
  }

  /** The catalogue's own filter, as its URL carries it. */
  familySub(family: Family): string {
    return familyLeaves(family).join(',');
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}

/** The API filters on leaf families: a family with children is asked for as its children. */
function familyLeaves(family: FamilyChoice): readonly string[] {
  const node = CATEGORIES.find((c) => c.id === family.category)?.subcategories.find(
    (s) => s.id === family.id,
  );
  return node?.children?.length ? node.children.map((c) => c.id) : [family.id];
}
