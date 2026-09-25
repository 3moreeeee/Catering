import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LegalPageBase } from './legal-page.base';
import { COMPANY } from '../../data/company.data';

@Component({
  selector: 'fk-terms-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="container--narrow legal">
        <h1 class="h1">{{ t('legal.termsTitle') }}</h1>

        <p class="legal__notice">{{ t('legal.placeholderNotice') }}</p>

        <div class="prose">
          <h2>Publisher</h2>
          <address>
            {{ company.legalName }} ({{ company.tradingName }})<br />
            {{ company.address.street }}, {{ company.address.postalCode }}
            {{ company.address.locality }}, {{ company.address.country }}<br />
            <span class="u-nums">{{ company.telephoneDisplay }}</span> —
            <a [href]="'mailto:' + company.email">{{ company.email }}</a>
          </address>
          <!-- Registration identifiers and hosting details are launch blockers.
               They are listed in docs/11-launch-blockers.md; the headings appear
               here only once the company has supplied the values. -->

          <h2>Catalogue information</h2>
          <p>
            Product information on this site is provided for guidance. Specifications, formats and
            availability are confirmed at the point of quotation. No prices are published on this
            site; all pricing is quoted on request.
          </p>

          <h2>Intellectual property</h2>
          <p>
            Brand names and logos shown on this site are the property of their respective owners
            and are used to identify the products we distribute.
          </p>
        </div>
      </div>
    </ng-container>
  `,
  styleUrl: './legal.scss',
})
export class TermsPage extends LegalPageBase {
  readonly company = COMPANY;

  constructor() {
    super();
    this.applySeo('legal.termsTitle', 'terms');
  }
}
