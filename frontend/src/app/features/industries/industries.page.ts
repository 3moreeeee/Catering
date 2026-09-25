import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import { LocalizedTextPipe } from '../../shared/pipes/localized-text.pipe';
import { RevealDirective } from '../../core/motion/reveal.directive';
import { INDUSTRY_REPOSITORY } from '../../data/repositories/catalog.repository';
import { CATEGORIES } from '../../data/categories.data';
import { CategoryId } from '../../shared/models/catalog.model';

/**
 * Industries page.
 *
 * Each sector explains how the company supports it and links straight into the
 * catalogue filtered to that sector — turning a positioning page into a
 * discovery path. Sectors not named by the company carry a visible marker.
 */
@Component({
  selector: 'fk-industries-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, RevealDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="container industries">
        <header class="industries__head">
          <h1 class="h1">{{ t('industries.title') }}</h1>
          <p class="u-lead">{{ t('industries.lead') }}</p>
        </header>

        <ul class="industries__list">
          @for (industry of industries(); track industry.id) {
            <li class="industries__item" [id]="industry.slug" fkReveal>
              <div class="industries__aside">
                <h2 class="h3">{{ industry.name | localized }}</h2>
                <p class="u-sm u-muted">{{ industry.description | localized }}</p>
              </div>

              <div class="industries__body">
                <h3 class="u-label">{{ t('industries.howWeSupport') }}</h3>
                <p class="u-body">{{ industry.howWeSupport | localized }}</p>

                <h3 class="u-label">{{ t('industries.relevantProducts') }}</h3>
                <ul class="industries__chips">
                  @for (categoryId of industry.relevantCategories; track categoryId) {
                    <li>
                      <a
                        class="chip"
                        [routerLink]="to('products/' + slugFor(categoryId))"
                        [queryParams]="{ industry: industry.id }"
                        >{{ nameFor(categoryId) | localized }}</a
                      >
                    </li>
                  }
                </ul>

                <a
                  class="link link--accent"
                  [routerLink]="to('products')"
                  [queryParams]="{ industry: industry.id }"
                >
                  {{ t('industries.viewProducts') }}
                  <span class="link__arrow" aria-hidden="true">→</span>
                </a>
              </div>
            </li>
          }
        </ul>
      </div>
    </ng-container>
  `,
  styleUrl: './industries.page.scss',
})
export class IndustriesPage {
  private readonly links = inject(LocalizedRouter);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(StructuredDataService);
  private readonly transloco = inject(TranslocoService);

  readonly industries = toSignal(inject(INDUSTRY_REPOSITORY).all(), { initialValue: [] });

  constructor() {
    queueMicrotask(() => {
      this.seo.apply({
        title: this.transloco.translate('industries.title'),
        description: this.transloco.translate('industries.lead'),
        path: 'industries',
      });
      this.jsonLd.set([
        this.jsonLd.organization(),
        this.jsonLd.breadcrumbs([
          { name: this.transloco.translate('nav.home'), path: this.links.url('') },
          {
            name: this.transloco.translate('industries.title'),
            path: this.links.url('industries'),
          },
        ]),
      ]);
    });
  }

  slugFor(id: CategoryId): string {
    return CATEGORIES.find((c) => c.id === id)?.slug ?? id;
  }

  nameFor(id: CategoryId) {
    return CATEGORIES.find((c) => c.id === id)?.shortName ?? { en: id, fr: id };
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
