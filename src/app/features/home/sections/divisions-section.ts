import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import {
  CATEGORY_REPOSITORY,
  PRODUCT_REPOSITORY,
} from '../../../data/repositories/catalog.repository';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { RevealDirective } from '../../../core/motion/reveal.directive';
import { CategoryId } from '../../../shared/models/catalog.model';
import { FILM_PALETTE, FilmPalette } from './film-palette';
import { CinematicMedia } from '../../../shared/components/cinematic-media/cinematic-media';

/** One film per division, so each panel is graded by its own footage. */
const DIVISION_STILL: Readonly<Record<CategoryId, string>> = {
  food: 'sauce-burger',
  monin: 'monin-fraicheur',
  packaging: 'emballage-verrine',
  hygiene: 'hygiene-protocole',
};

/**
 * Where the subject actually sits in each still, as a percentage of the frame's
 * width. Measured, not judged: a column pass over each poster returns the
 * horizontal extent of everything that is not background, and these are the
 * midpoints of those extents.
 *
 *   sauce-burger        burger + mayonnaise jar   21.1% – 92.7%  → 56.9%
 *   emballage-verrine   the verrine                30.2% – 69.3%  → 49.7%
 *   hygiene-jetable     the coat placket and button, a centred detail → 50%
 *
 * The panels are much taller than the 16:9 stills, so `cover` throws away width
 * — a quarter of it on desktop. Centring the *frame* therefore centres nothing:
 * it cut the right-hand third off the mayonnaise jar, which is the only thing
 * in that photograph identifying the product being sold. The stylesheet uses
 * these to centre the subject instead. See `.divisions__still`.
 */
const SUBJECT_X: Readonly<Record<CategoryId, string>> = {
  food: '56.9%',
  monin: '66%',
  packaging: '49.7%',
  hygiene: '50%',
};

/**
 * The divisions, as a triptych.
 *
 * This was three rows of text with a small image at the end — accurate,
 * useful, and completely flat. It tabulated the range instead of presenting it,
 * and it wasted the one thing that makes this company's three divisions feel
 * different from each other: they do not look alike.
 *
 * Now each division is a full-height panel carrying its own film still at full
 * bleed, graded with the ground and light sampled from that film. Three worlds
 * stand side by side and the difference between them is visible before a word
 * is read. Hygiene is the pale one — its film is a high-key clean room — which
 * establishes the light/dark rule that the hygiene chapter later pays off.
 *
 * The panels are edge to edge with no gap, no radius and no shadow: a triptych,
 * not three cards. And nothing was traded away for the composition — all
 * twenty-one product families are still live links inside their panel, so the
 * section is as useful as the list it replaced.
 */
@Component({
  selector: 'fk-divisions-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, RevealDirective, CinematicMedia],
  template: `
    <ng-container *transloco="let t">
      <header class="container divisions__head" fkReveal>
        <p class="u-eyebrow">{{ t('home.showcase.eyebrow') }}</p>
        <h2>{{ t('home.showcase.title') }}</h2>
        <p class="u-lead">{{ t('home.showcase.lead') }}</p>
      </header>

      <ul class="divisions__triptych">
        @for (category of categories(); track category.id; let i = $index) {
          <li
            class="divisions__panel"
            [class.is-light]="palette(category.id).highKey"
            [style.--film-ground]="palette(category.id).ground"
            [style.--film-glow]="palette(category.id).glow"
            [style.--cat-accent]="category.accent"
            [style.--subject-x]="subjectX(category.id)"
            fkReveal
            [revealDelay]="i * 90"
          >
            <div class="divisions__frame">
              <fk-cinematic-media
                class="divisions__still"
                [slug]="still(category.id)"
                [alt]="category.name | localized"
                [once]="true"
              />
              <div class="divisions__grade" aria-hidden="true"></div>
            </div>

            <div class="divisions__content">
              <span class="divisions__num u-nums" aria-hidden="true">0{{ i + 1 }}</span>

              <h3 class="divisions__name">
                <a class="divisions__name-link" [routerLink]="to('products/' + category.slug)">
                  {{ category.name | localized }}
                </a>
              </h3>

              <p class="divisions__desc">{{ category.description | localized }}</p>

              <ul class="divisions__families">
                @for (sub of category.subcategories; track sub.id) {
                  <li>
                    <a
                      class="divisions__family"
                      [routerLink]="to('products')"
                      [queryParams]="{ sub: sub.id }"
                      >{{ sub.name | localized }}</a
                    >
                  </li>
                }
              </ul>

              <p class="divisions__count u-nums">
                {{ t('home.divisions.referenceCount', { count: countFor(category.id) }) }}
              </p>
            </div>
          </li>
        }
      </ul>
    </ng-container>
  `,
  styleUrl: './divisions-section.scss',
})
export class DivisionsSection {
  private readonly links = inject(LocalizedRouter);
  private readonly categoryRepo = inject(CATEGORY_REPOSITORY);
  private readonly productRepo = inject(PRODUCT_REPOSITORY);

  readonly categories = toSignal(this.categoryRepo.all(), { initialValue: [] });
  private readonly counts = toSignal(this.productRepo.countByCategory(), {
    initialValue: { food: 0, monin: 0, packaging: 0, hygiene: 0 },
  });

  countFor(id: CategoryId): number {
    return this.counts()[id];
  }

  still(id: CategoryId): string {
    return DIVISION_STILL[id];
  }

  /** Horizontal midpoint of this still's subject. See SUBJECT_X. */
  subjectX(id: CategoryId): string {
    return SUBJECT_X[id] ?? '50%';
  }

  palette(id: CategoryId): FilmPalette {
    return (
      FILM_PALETTE[DIVISION_STILL[id]] ?? { ground: 'var(--c-forest-900)', glow: 'var(--c-forest-600)', highKey: false }
    );
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
