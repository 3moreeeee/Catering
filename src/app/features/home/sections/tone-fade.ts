import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The join between two visual worlds.
 *
 * Sections used to end and the next one begin, which is what made every chapter
 * read as a separate rectangle stacked on the last. This is a band of pure
 * ground that interpolates from the colour above it to the colour below, so a
 * chapter's darkness becomes the next chapter's darkness without an edge
 * anywhere in between.
 *
 * It is a gradient and nothing else: no JavaScript, no scroll listener, no
 * transform. It costs one element and it is what lets four differently graded
 * films sit on one continuous page.
 */
@Component({
  selector: 'fk-tone-fade',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    'aria-hidden': 'true',
    '[style.--fade-from]': 'from()',
    '[style.--fade-to]': 'to()',
    '[style.--fade-height]': 'height()',
  },
  styles: `
    :host {
      display: block;
      block-size: var(--fade-height, clamp(2.25rem, 7vw, 6.5rem));
      background-image: linear-gradient(to bottom, var(--fade-from), var(--fade-to));
    }
  `,
})
export class ToneFade {
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  /** Longer for the big register changes, such as dark into the high-key clean room. */
  readonly height = input('clamp(2.25rem, 7vw, 6.5rem)');
}
