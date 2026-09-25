import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { RevealDirective } from '../../../core/motion/reveal.directive';
import { CinematicMedia } from '../../../shared/components/cinematic-media/cinematic-media';
import { FILM_PALETTE } from './film-palette';

/**
 * How a chapter is composed. Four forms, each used once, so no two chapters on
 * the page are built the same way.
 *
 * - `immersive` — the film is the section. It fills the viewport and the copy
 *   lives inside the darkness the frame already contains.
 * - `oversized` — copy left on the film's own ground, film right, bleeding off
 *   the outer edge but staying inside the section's height. An earlier version
 *   pushed it past the section with negative margins; at a portrait ratio that
 *   made the frame taller than the viewport and it read as a picture that had
 *   outgrown the page.
 *
 * Both chapters currently use `oversized`, because copy left / film right is
 * the reading order the layout should have: the film's product sits on the
 * right of frame in both, so any composition that puts type there hides it.
 * They are told apart by `scale`, not by mirroring — two adjacent blocks that
 * are each other's reflection read as a template, whereas the same order at
 * markedly different weights reads as pacing.
 */
export type ChapterVariant = 'immersive' | 'oversized';

/** How much room the film takes. See the note on ChapterVariant. */
export type ChapterScale = 'standard' | 'large';

/**
 * A sensory chapter.
 *
 * The previous version put a rectangle of film beside a column of text, and it
 * read as exactly that. Two things were wrong, and only one of them was layout.
 *
 * The real fault was colour. Every section was painted `--c-forest-900`, a
 * green-black, while the grill film is graded to a neutral charcoal and the
 * Monin film to a deep teal. A film's edge therefore met a surface of a
 * *different* black, and that mismatch is what the eye reads as a pasted-on
 * rectangle. Each chapter is now graded to its own film: the ground is sampled
 * from the footage by `scripts/sample-film-palette.mjs`, so the frame's edge
 * meets its own darkness.
 *
 * With the grounds matched, the boundary can be removed altogether — the media
 * is feathered with a mask on whichever edges face the page, so it dissolves
 * instead of stopping. The film's own light is then extended past the frame as
 * a very low-opacity radial wash in the colour sampled from its highlights, so
 * the section is lit by the film rather than merely containing it.
 */
@Component({
  selector: 'fk-chapter-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CinematicMedia, RevealDirective],
  template: `
    <div class="chapter__light" aria-hidden="true"></div>

    <div class="chapter__media">
      <fk-cinematic-media
        [slug]="slug()"
        [alt]="mediaAlt()"
        [mediaWidth]="mediaWidth()"
        [mediaHeight]="mediaHeight()"
      />
      <div class="chapter__dissolve" aria-hidden="true"></div>
    </div>

    <div class="chapter__copy">
      <div class="chapter__copy-inner" fkReveal="fade-up">
        <p class="chapter__eyebrow">{{ eyebrow() }}</p>
        <h2 class="chapter__title">{{ title() }}</h2>
        <p class="chapter__body">{{ body() }}</p>
        <a class="chapter__cta" [routerLink]="to(ctaPath())">
          {{ ctaLabel() }}
          <span class="chapter__arrow" aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  `,
  styleUrl: './chapter-section.scss',
  host: {
    // A data attribute rather than class bindings: the variant is one-of-a-set
    // state, and an attribute selector keeps the stylesheet readable without
    // four boolean class bindings fighting over the class attribute.
    //
    // There is no mirror flag. Alternating a fixed layout left/right is the
    // template this redesign removed; the four variants are the variation.
    '[attr.data-variant]': 'variant()',
    '[attr.data-scale]': 'scale()',
    '[class.on-dark]': '!palette().highKey',
    '[style.--film-ground]': 'palette().ground',
    '[style.--film-glow]': 'palette().glow',
    // Bound as null when unset so Angular removes the property entirely and the
    // stylesheet's own fallback applies. An empty custom property would make
    // the var() that reads it invalid at computed-value time and take the whole
    // declaration down with it.
    '[style.--cm-focus]': 'focus()',
    '[style.--chapter-ratio]': 'mediaRatio()',
  },
})
export class ChapterSection {
  readonly slug = input.required<string>();
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly ctaLabel = input.required<string>();
  readonly ctaPath = input.required<string>();
  readonly mediaAlt = input.required<string>();
  readonly variant = input<ChapterVariant>('oversized');
  readonly scale = input<ChapterScale>('standard');
  readonly mediaWidth = input(1280);
  readonly mediaHeight = input(720);
  /**
   * Where the frame is anchored inside its box, as an `object-position`.
   *
   * The chapter frames are taller than their 16:9 sources, so the box always
   * trims width. Left at the default the trim is even, which is only right when
   * the subject is in the middle of the shot. It often is not: the Monin film
   * puts the glass and the bottle in its right half and leaves the left half as
   * empty dark wall, and an even trim renders that as a column of text, a wide
   * void, and a product cut in half by the edge of the screen.
   *
   * Set per chapter, from the film, never from a preference for symmetry.
   */
  readonly focus = input<string | null>(null);
  /**
   * Overrides the variant's own frame ratio at desktop widths. A narrower ratio
   * trims more width, which is how a chapter crops into its subject rather than
   * showing the whole shot smaller.
   */
  readonly mediaRatio = input<string | null>(null);

  private readonly links = inject(LocalizedRouter);

  /** Sampled from this chapter's own poster. See the class comment. */
  readonly palette = computed(
    () => FILM_PALETTE[this.slug()] ?? { ground: 'var(--c-forest-900)', glow: 'var(--c-forest-600)', highKey: false },
  );

  to(path: string): string[] {
    return this.links.path(path);
  }
}
