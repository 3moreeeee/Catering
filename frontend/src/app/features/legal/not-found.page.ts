import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'fk-not-found-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="container nf">
        <p class="nf__code u-nums" aria-hidden="true">{{ t('notFound.code') }}</p>
        <h1 class="h1">{{ t('notFound.title') }}</h1>
        <p class="u-lead">{{ t('notFound.lead') }}</p>

        <div class="cluster nf__actions">
          <a class="btn btn--primary btn--lg" [routerLink]="to('')">{{ t('notFound.home') }}</a>
          <a class="btn btn--secondary btn--lg" [routerLink]="to('products')">{{
            t('notFound.products')
          }}</a>
        </div>
      </div>
    </ng-container>
  `,
  styles: `
    .nf {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-4);
      padding-block: var(--sp-24) var(--sp-32);
    }
    .nf__code {
      font-family: var(--font-display);
      font-size: clamp(4rem, 3rem + 6vw, 9rem);
      font-weight: var(--fw-semibold);
      line-height: 1;
      letter-spacing: -0.04em;
      color: var(--c-ivory-200);
      margin: 0;
    }
    h1,
    p {
      margin: 0;
    }
    .nf__actions {
      margin-top: var(--sp-4);
    }
  `,
})
export class NotFoundPage {
  private readonly links = inject(LocalizedRouter);
  private readonly seo = inject(SeoService);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    queueMicrotask(() => {
      this.seo.apply({
        title: this.transloco.translate('notFound.title'),
        description: this.transloco.translate('notFound.lead'),
        path: '404',
        noIndex: true,
      });
    });
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
