import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import { LocalizedTextPipe } from '../../shared/pipes/localized-text.pipe';
import { BRAND_REPOSITORY, PRODUCT_REPOSITORY } from '../../data/repositories/catalog.repository';
import { CategoryId } from '../../shared/models/catalog.model';
import { CATEGORIES } from '../../data/categories.data';
import { normalize } from '../../data/repositories/in-memory.repository';

/**
 * Brand directory.
 *
 * Lists only the partners verifiable from the legacy site. The note at the foot
 * states that the list is incomplete rather than implying it is exhaustive —
 * the honest position, and the one that prompts the owner to supply the rest.
 */
@Component({
  selector: 'fk-brands-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, FormsModule, LocalizedTextPipe],
  templateUrl: './brands.page.html',
  styleUrl: './brands.page.scss',
})
export class BrandsPage {
  private readonly links = inject(LocalizedRouter);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(StructuredDataService);
  private readonly transloco = inject(TranslocoService);

  private readonly allBrands = toSignal(inject(BRAND_REPOSITORY).all(), { initialValue: [] });
  private readonly products = toSignal(inject(PRODUCT_REPOSITORY).all(), { initialValue: [] });

  readonly categories = CATEGORIES;
  readonly search = signal('');
  readonly categoryFilter = signal<CategoryId | null>(null);

  readonly brands = computed(() => {
    const term = normalize(this.search());
    const category = this.categoryFilter();

    return this.allBrands().filter((brand) => {
      if (category && !brand.categoryIds.includes(category)) {
        return false;
      }
      if (term && !normalize(brand.name).includes(term)) {
        return false;
      }
      return true;
    });
  });

  constructor() {
    queueMicrotask(() => {
      this.seo.apply({
        title: this.transloco.translate('brands.title'),
        description: this.transloco.translate('brands.lead'),
        path: 'brands',
      });
      this.jsonLd.set([
        this.jsonLd.organization(),
        this.jsonLd.breadcrumbs([
          { name: this.transloco.translate('nav.home'), path: this.links.url('') },
          { name: this.transloco.translate('brands.title'), path: this.links.url('brands') },
        ]),
      ]);
    });
  }

  productCount(brandId: string): number {
    return this.products().filter((product) => product.brandId === brandId).length;
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
