import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { RevealDirective } from '../../../core/motion/reveal.directive';

@Component({
  selector: 'fk-value-proposition-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, RevealDirective],
  template: `
    <ng-container *transloco="let t">
      <section class="value" aria-labelledby="value-title">
        <div class="container value__inner">
          <header class="value__head" fkReveal>
            <p class="u-eyebrow">{{ t('home.benefits.eyebrow') }}</p>
            <h2 id="value-title">{{ t('home.benefits.title') }}</h2>
            <p class="u-lead">{{ t('home.benefits.lead') }}</p>
          </header>

          <ul class="value__grid" fkReveal="stagger" revealChildren=".value__item">
            @for (item of items; track item.key; let i = $index) {
              <li class="value__item">
                <span class="value__icon" aria-hidden="true">
                  @switch (item.icon) {
                    @case ('range') {
                      <svg viewBox="0 0 24 24">
                        <path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" />
                      </svg>
                    }
                    @case ('format') {
                      <svg viewBox="0 0 24 24">
                        <path d="M7 4h10v16H7zM10 8h4M10 12h4M10 16h2" />
                      </svg>
                    }
                    @case ('advice') {
                      <svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" /></svg>
                    }
                    @default {
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M4 15V7h11v8M15 10h3l2 3v2h-5M8 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 17h2M10 17h5"
                        />
                      </svg>
                    }
                  }
                </span>
                <span class="value__num u-nums">0{{ i + 1 }}</span>
                <h3>{{ t('home.benefits.items.' + item.key + '.title') }}</h3>
                <p>{{ t('home.benefits.items.' + item.key + '.body') }}</p>
              </li>
            }
          </ul>
        </div>
      </section>
    </ng-container>
  `,
  styles: `
    @use '../../../../styles/abstracts/mixins' as *;

    :host {
      display: block;
    }

    .value {
      padding-block: var(--section-y);
      background:
        radial-gradient(circle at 8% 16%, rgb(var(--c-ui-rgb) / 0.16), transparent 23rem),
        var(--c-forest-900);
      color: var(--c-ivory-50);
    }

    .value__inner {
      display: grid;
      gap: clamp(2.5rem, 6vw, 6rem);

      @include bp(lg) {
        grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
        align-items: start;
      }
    }

    .value__head {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);

      @include bp(lg) {
        position: sticky;
        inset-block-start: calc(var(--header-h) + var(--sp-8));
      }

      .u-eyebrow {
        color: var(--c-copper-400);
      }
      h2 {
        margin: 0;
        color: var(--c-ivory-50);
      }
      .u-lead {
        color: var(--c-dark-secondary);
      }
    }

    .value__grid {
      display: grid;
      gap: var(--sp-4);
      margin: 0;
      padding: 0;
      list-style: none;

      @include bp(md) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .value__item {
      position: relative;
      display: grid;
      align-content: start;
      gap: var(--sp-3);
      min-block-size: 16rem;
      padding: clamp(1.5rem, 3vw, 2rem);
      border: 1px solid rgb(255 255 255 / 0.13);
      border-radius: var(--r-md);
      background: rgb(255 255 255 / 0.055);
      transition:
        transform var(--d-base) var(--ease-out),
        background-color var(--d-base) var(--ease-out),
        border-color var(--d-base) var(--ease-out);

      &:hover {
        border-color: rgb(var(--c-ui-rgb) / 0.5);
        background: rgb(255 255 255 / 0.08);
        @include fine-pointer {
          transform: translateY(-4px);
        }
      }

      h3 {
        margin: var(--sp-3) 0 0;
        color: var(--c-ivory-50);
        font-size: var(--fs-h4);
      }
      p {
        margin: 0;
        color: var(--c-dark-muted);
        font-size: var(--fs-sm);
        line-height: var(--lh-body);
      }
    }

    .value__icon {
      display: grid;
      place-items: center;
      inline-size: 3rem;
      block-size: 3rem;
      border-radius: var(--r-sm);
      background: color-mix(in oklab, var(--c-copper-500) 16%, transparent);
      color: var(--c-copper-400);

      svg {
        inline-size: 1.5rem;
        block-size: 1.5rem;
        fill: none;
        stroke: currentcolor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    }

    .value__num {
      position: absolute;
      inset-block-start: var(--sp-6);
      inset-inline-end: var(--sp-6);
      font-size: var(--fs-xs);
      color: var(--c-dark-disabled);
    }

    @include motion-reduce {
      .value__item {
        transition: none;
      }
    }
  `,
})
export class ValuePropositionSection {
  readonly items = [
    { key: 'range', icon: 'range' },
    { key: 'formats', icon: 'format' },
    { key: 'advice', icon: 'advice' },
    { key: 'distribution', icon: 'distribution' },
  ] as const;
}
