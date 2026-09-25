import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LegalPageBase } from './legal-page.base';
import { COMPANY } from '../../data/company.data';

@Component({
  selector: 'fk-privacy-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="container--narrow legal">
        <h1 class="h1">{{ t('legal.privacyTitle') }}</h1>

        <p class="legal__notice">{{ t('legal.placeholderNotice') }}</p>

        <div class="prose">
          <h2>Data we collect</h2>
          <p>
            When you submit an enquiry we collect the name, company, email address, telephone
            number, job title and message you provide, together with the product or category your
            enquiry relates to.
          </p>

          <h2>How we use it</h2>
          <p>
            We use these details only to respond to your enquiry and to maintain the commercial
            relationship that follows from it. We do not sell or share them with third parties.
          </p>

          <h2>Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data by writing
            to <a [href]="'mailto:' + company.email">{{ company.email }}</a>.
          </p>

          <h2>Contact</h2>
          <address>
            {{ company.legalName }}<br />
            {{ company.address.street }}, {{ company.address.postalCode }}
            {{ company.address.locality }}, {{ company.address.country }}<br />
            <a [href]="'mailto:' + company.email">{{ company.email }}</a>
          </address>
        </div>
      </div>
    </ng-container>
  `,
  styleUrl: './legal.scss',
})
export class PrivacyPage extends LegalPageBase {
  readonly company = COMPANY;

  constructor() {
    super();
    this.applySeo('legal.privacyTitle', 'privacy');
  }
}
