import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';

interface Benefit {
  readonly key: string;
  readonly icon: string;
}

const BENEFITS: readonly Benefit[] = [
  { key: 'range', icon: 'M4 7h16M4 12h16M4 17h10' },
  {
    key: 'formats',
    icon: 'M12 3 20.5 7.5v9L12 21l-8.5-4.5v-9L12 3Zm0 9 8.5-4.5M12 12 3.5 7.5M12 12v9',
  },
  {
    key: 'coverage',
    icon: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  },
];

/** The professional quote call to action and the three reassurances under it. */
@Component({
  selector: 'fk-quote-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="container wrap">
        <section class="quote" aria-labelledby="home-quote-title">
          <svg class="quote__icon" width="56" height="56" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9 4h6v3H9V4Zm-2 1.5H5v15h14v-15h-2M8 12l1.2 1.2L11.5 11M8 17l1.2 1.2 2.3-2.2M14 12.5h2.5M14 17.5h2.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <div class="quote__text">
            <h2 id="home-quote-title">{{ t('home.quote.title') }}</h2>
            <p>{{ t('home.quote.lead') }}</p>
          </div>
          <a class="btn btn--lg quote__cta" [routerLink]="to('contact')">
            {{ t('home.quote.cta') }} <span aria-hidden="true">›</span>
          </a>
        </section>

        <ul class="benefits">
          @for (benefit of benefits; track benefit.key) {
            <li class="benefit">
              <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  [attr.d]="benefit.icon"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p>
                <strong>{{ t('home.quote.benefits.' + benefit.key + '.title') }}</strong>
                {{ t('home.quote.benefits.' + benefit.key + '.body') }}
              </p>
            </li>
          }
        </ul>
      </div>
    </ng-container>
  `,
  styles: `
    @use '../../../../styles/abstracts/mixins' as *;

    :host {
      display: block;
      background-color: var(--surface-page);
    }

    .wrap {
      padding-block: clamp(1rem, 2vw, 1.5rem) clamp(2rem, 4vw, 3rem);
    }

    .quote {
      display: grid;
      gap: var(--sp-5);
      padding: clamp(1.5rem, 3vw, 2.25rem) clamp(1.5rem, 4vw, 4rem);
      border-radius: var(--r-md);
      background-color: var(--c-orange-600);
      color: var(--c-white);

      @include bp(md) {
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        column-gap: clamp(1.5rem, 3vw, 2.5rem);
      }
    }

    .quote__icon {
      display: none;

      @include bp(md) {
        display: block;
      }
    }

    .quote__text {
      @include bp(md) {
        padding-inline-start: clamp(1.5rem, 3vw, 2.5rem);
        border-inline-start: 1px solid rgb(255 255 255 / 0.28);
      }

      h2 {
        @include display(clamp(1.5rem, 1.2rem + 1vw, 2.125rem));
        margin: 0 0 var(--sp-2);
        color: inherit;
      }

      p {
        margin: 0;
        font-size: var(--fs-sm);
        line-height: var(--lh-snug);
      }
    }

    .quote__cta {
      --btn-bg: var(--c-white);
      --btn-fg: var(--c-teal-900);
      --btn-border: var(--c-white);
      border-radius: var(--r-sm);
    }

    .benefits {
      display: grid;
      gap: var(--sp-5);
      margin: clamp(1.5rem, 3vw, 2.25rem) 0 0;
      padding: 0;
      list-style: none;

      @include bp(md) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .benefit {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      color: var(--c-teal-900);

      svg {
        flex: none;
      }

      p {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--fs-xs);
        line-height: var(--lh-snug);
      }

      strong {
        display: block;
        color: var(--c-teal-900);
        font-size: var(--fs-sm);
      }

      @include bp(md) {
        justify-content: center;

        & + & {
          border-inline-start: 1px solid var(--border-hairline);
        }
      }
    }
  `,
})
export class QuoteSection {
  private readonly links = inject(LocalizedRouter);
  readonly benefits = BENEFITS;

  to(path: string): string[] {
    return this.links.path(path);
  }
}
