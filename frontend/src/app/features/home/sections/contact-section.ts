import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { RevealDirective } from '../../../core/motion/reveal.directive';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { COMPANY } from '../../../data/company.data';
import { GoogleMapCard } from '../../../shared/components/google-map-card/google-map-card';

/**
 * Section 9 — contact and location.
 *
 * The Google Maps embed searches the company's published postal address. No
 * coordinate is guessed or added to the structured company data.
 */
@Component({
  selector: 'fk-contact-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, RevealDirective, GoogleMapCard, LocalizedTextPipe],
  template: `
    <ng-container *transloco="let t">
      <div class="container contact__inner">
        <div class="contact__details" fkReveal>
          <p class="u-eyebrow">{{ t('home.contact.eyebrow') }}</p>
          <h2 class="sec__title">{{ t('home.contact.title') }}</h2>
          <p class="u-lead">{{ t('home.contact.lead') }}</p>

          <address class="contact__address">
            <div class="contact__row">
              <span class="u-label">{{ t('contact.address') }}</span>
              <span
                >{{ company.address.street }}, {{ company.address.postalCode }}
                {{ company.address.locality }}, {{ company.address.country }}</span
              >
            </div>
            <div class="contact__row">
              <span class="u-label">{{ t('contact.telephone') }}</span>
              <a class="link" [href]="'tel:' + company.telephone">
                <span class="u-nums">{{ company.telephoneDisplay }}</span>
              </a>
            </div>
            @if (company.faxDisplay) {
              <div class="contact__row">
                <span class="u-label">{{ t('contact.fax') }}</span>
                <span class="u-nums u-muted">{{ company.faxDisplay }}</span>
              </div>
            }
            <div class="contact__row">
              <span class="u-label">{{ t('contact.email') }}</span>
              <a class="link" [href]="'mailto:' + company.email">{{ company.email }}</a>
            </div>
            @if (company.businessHours; as hours) {
              <div class="contact__row">
                <span class="u-label">{{ t('contact.hours') }}</span>
                <span>{{ hours | localized }}</span>
              </div>
            }
          </address>

          <a class="btn btn--primary btn--lg" [routerLink]="to('contact')">
            {{ t('nav.cta') }}
          </a>
        </div>

        <fk-google-map-card fkReveal />
      </div>
    </ng-container>
  `,
  styles: `
    @use '../../../../styles/abstracts/mixins' as *;

    :host {
      display: block;
      background-color: var(--surface-alt);
      padding-block: var(--section-y);
    }

    .contact__inner {
      display: grid;
      gap: var(--sp-10);
      align-items: start;

      @include bp(lg) {
        grid-template-columns: 5fr 7fr;
        gap: var(--sp-12);
      }
    }

    .contact__details {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-4);
    }

    .contact__address {
      font-style: normal;
      display: grid;
      gap: var(--sp-4);
      inline-size: 100%;
      padding-block: var(--sp-5);
      border-block: 1px solid var(--border-hairline);
      margin-block: var(--sp-2);
    }

    .contact__row {
      display: grid;
      gap: var(--sp-1);
      font-size: var(--fs-sm);
    }

    .contact__pending {
      display: inline-block;
      padding: 2px var(--sp-2);
      border: 1px dashed var(--border-neutral);
      border-radius: var(--r-xs);
      color: var(--text-muted);
      margin: 0;
    }
  `,
  styleUrls: ['./home-sections.scss'],
})
export class ContactSection {
  private readonly links = inject(LocalizedRouter);
  readonly company = COMPANY;

  to(path: string): string[] {
    return this.links.path(path);
  }
}
