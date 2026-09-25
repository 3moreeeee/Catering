import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import { LocalizedTextPipe } from '../../shared/pipes/localized-text.pipe';
import { RevealDirective } from '../../core/motion/reveal.directive';
import {
  CATEGORY_REPOSITORY,
  INDUSTRY_REPOSITORY,
} from '../../data/repositories/catalog.repository';
import {
  COMPANY,
  PUBLISHED_MILESTONES,
  COMPANY_VALUES,
  PRESIDENT_MESSAGE,
} from '../../data/company.data';

/**
 * About page.
 *
 * Built entirely from what the company has actually said. The founder's message
 * appears in full — it is the strongest asset the old site had, and it was
 * buried mid-homepage with no URL of its own.
 *
 * No certifications, awards, employee numbers or operational statistics appear
 * anywhere on this page, because the company has published none.
 */
@Component({
  selector: 'fk-about-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, RevealDirective],
  templateUrl: './about.page.html',
  styleUrl: './about.page.scss',
})
export class AboutPage {
  private readonly links = inject(LocalizedRouter);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(StructuredDataService);
  private readonly transloco = inject(TranslocoService);

  readonly categories = toSignal(inject(CATEGORY_REPOSITORY).all(), { initialValue: [] });
  readonly industries = toSignal(inject(INDUSTRY_REPOSITORY).all(), { initialValue: [] });

  readonly company = COMPANY;
  readonly message = PRESIDENT_MESSAGE;
  readonly milestones = PUBLISHED_MILESTONES();
  readonly values = COMPANY_VALUES;

  constructor() {
    queueMicrotask(() => {
      this.seo.apply({
        title: this.transloco.translate('about.title'),
        description: this.transloco.translate('about.lead'),
        path: 'about',
      });
      this.jsonLd.set([
        this.jsonLd.organization(),
        this.jsonLd.breadcrumbs([
          { name: this.transloco.translate('nav.home'), path: this.links.url('') },
          { name: this.transloco.translate('about.title'), path: this.links.url('about') },
        ]),
      ]);
    });
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
