import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import { BrandsSection } from './sections/brands-section';
import { ContactSection } from './sections/contact-section';
import { DivisionsSection } from './sections/divisions-section';
import { FeaturedSection } from './sections/featured-section';
import { HeroSection } from './sections/hero-section';
import { OffersSection } from './sections/offers-section';
import { SectorIndex } from './sections/sector-index';
import { ValuePropositionSection } from './sections/value-proposition-section';

/**
 * Commercial showcase homepage.
 *
 * The sequence follows a professional buyer's questions: what is supplied,
 * which ranges are available, why the company is credible, whether it serves
 * their trade, which manufacturers it represents, and how to request an offer.
 */
@Component({
  selector: 'fk-home-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroSection,
    DivisionsSection,
    FeaturedSection,
    OffersSection,
    ValuePropositionSection,
    SectorIndex,
    BrandsSection,
    ContactSection,
    TranslocoDirective,
  ],
  template: `
    <ng-container *transloco="let t">
      <fk-hero-section />

      @defer (on viewport; hydrate on viewport) {
        <fk-divisions-section />
      } @placeholder {
        <div class="defer-ph defer-ph--lg"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-featured-section />
      } @placeholder {
        <div class="defer-ph defer-ph--lg defer-ph--alt"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-offers-section />
      } @placeholder {
        <div class="defer-ph defer-ph--sm"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-value-proposition-section />
      } @placeholder {
        <div class="defer-ph defer-ph--md"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-sector-index />
      } @placeholder {
        <div class="defer-ph defer-ph--lg"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-brands-section />
      } @placeholder {
        <div class="defer-ph defer-ph--sm"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <fk-contact-section />
      } @placeholder {
        <div class="defer-ph defer-ph--md defer-ph--alt"></div>
      }
    </ng-container>
  `,
  styles: `
    .defer-ph {
      display: block;
      background-color: var(--surface-page);
    }
    .defer-ph--alt {
      background-color: var(--surface-alt);
    }
    .defer-ph--sm {
      block-size: 22rem;
    }
    .defer-ph--md {
      block-size: 34rem;
    }
    .defer-ph--lg {
      block-size: 46rem;
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
