import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RevealDirective } from '../../../core/motion/reveal.directive';

/**
 * A chapter marker — the page's spine.
 *
 * The homepage alternates between two grounds, forest and ivory, and every
 * change of ground means something: forest is the wall the films are shot
 * against, ivory is the counter the work happens on. A seam sits at each
 * transition and names what follows.
 *
 * The form is taken from the selection film: a numeral, a label, and a hairline
 * running off toward the edge of the frame, the way the light shaft runs along
 * the counter. It is a rule and two words — no box, no card, no icon — which is
 * what lets it appear four times without ever becoming decoration.
 *
 * The numeral is set in tabular figures at display size. In a distributor's
 * catalogue a number is not ornament, and this is the only place on the page
 * where type is allowed to be large without carrying a sentence.
 */
@Component({
  selector: 'fk-seam',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective],
  template: `
    <div class="container--wide seam__inner" fkReveal>
      <span class="seam__num u-nums" aria-hidden="true">{{ index() }}</span>
      <span class="seam__label">{{ label() }}</span>
      <span class="seam__rule" aria-hidden="true"></span>
    </div>
  `,
  host: {
    '[class.on-dark]': "tone() === 'dark'",
    '[class.seam--alt]': "tone() === 'alt'",
  },
  styles: `
    @use '../../../../styles/abstracts/mixins' as *;

    :host {
      display: block;
      background-color: var(--surface-page);
      color: var(--text-primary);
      /* Tight above, nothing below: a seam belongs to the section it names, so
         it sits directly on that section's ground with no gap between them. */
      padding-block: clamp(2rem, 4vw, 3rem) 0;
    }

    :host(.seam--alt) {
      background-color: var(--surface-alt);
    }

    .seam__inner {
      display: flex;
      align-items: baseline;
      gap: var(--sp-4);
    }

    .seam__num {
      font-family: var(--font-display);
      font-size: var(--fs-h3);
      font-weight: var(--fw-semibold);
      line-height: 1;
      letter-spacing: var(--ls-heading);
      color: var(--text-accent);
    }

    .seam__label {
      @include label;
      color: var(--text-secondary);
    }

    /* Runs off toward the frame edge, the way the light runs along the counter. */
    .seam__rule {
      flex: 1;
      block-size: 1px;
      background-color: var(--border-hairline);
      transform: translateY(-0.28em);
    }
  `,
})
export class Seam {
  /** Two-digit chapter number, e.g. "02". */
  readonly index = input.required<string>();
  readonly label = input.required<string>();
  /**
   * The ground of the section this seam introduces — not the one above it.
   * A seam that names the chapters has to be on the chapters' dark ground, or
   * it reads as the closing rule of the ivory block before it.
   */
  readonly tone = input<'light' | 'dark' | 'alt'>('light');
}
