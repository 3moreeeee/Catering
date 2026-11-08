import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import { BrandsSection } from './sections/brands-section';
import { FeaturedSection } from './sections/featured-section';
import { HeroSection } from './sections/hero-section';
import { OffersSection } from './sections/offers-section';
import { QuoteSection } from './sections/quote-section';
import { SectorsSection } from './sections/sectors-section';

/**
 * Commercial showcase homepage: campaign banners and divisions, the trades
 * served, a selection from the catalogue, live promotions when there are any,
 * brands, and the quote request.
 */
@Component({
  selector: 'fk-home-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroSection,
    SectorsSection,
    FeaturedSection,
    OffersSection,
    BrandsSection,
    QuoteSection,
    TranslocoDirective,
  ],
  template: `
    <ng-container *transloco="let t">
      <fk-hero-section />

      @defer (on viewport; hydrate on viewport) {
        <fk-sectors-section />
      } @placeholder {
        <div class="defer-ph defer-ph--lg"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-featured-section />
      } @placeholder {
        <div class="defer-ph defer-ph--lg"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-offers-section />
      } @placeholder {
        <div class="defer-ph"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-brands-section />
      } @placeholder {
        <div class="defer-ph defer-ph--sm"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-quote-section />
      } @placeholder {
        <div class="defer-ph defer-ph--sm"></div>
      }
    </ng-container>
  `,
  styles: `
    .defer-ph {
      display: block;
      min-block-size: 1px;
      background-color: var(--surface-page);
    }
    .defer-ph--sm {
      block-size: 14rem;
    }
    .defer-ph--lg {
      block-size: 28rem;
    }
  `,
})
export class HomePage {
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(StructuredDataService);
  private readonly transloco = inject(TranslocoService);
  private readonly locales = inject(LocaleService);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.locales.locale(),
  });

  constructor() {
    queueMicrotask(() => this.applySeo());
  }

  private applySeo(): void {
    void this.lang();
    this.seo.apply({
      title: this.transloco.translate('meta.tagline'),
      description: this.transloco.translate('meta.defaultDescription'),
      path: '',
      type: 'website',
    });

    const graph = [this.jsonLd.organization(), this.jsonLd.website()];
    const local = this.jsonLd.localBusiness();
    this.jsonLd.set(local ? [...graph, local] : graph);
  }
}
