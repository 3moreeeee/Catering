import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { PRODUCT_REPOSITORY } from '../../../data/repositories/catalog.repository';
import { RevealDirective } from '../../../core/motion/reveal.directive';

/**
 * The quiet moment.
 *
 * After a dark, moving, appetite-driven opening the page cuts hard to the ivory
 * ground and stops. Nothing animates, nothing plays, there is no image. A page
 * that is spectacular from top to bottom has no dynamics — this section exists
 * so the chapters that follow have something to be loud against.
 *
 * The thesis is the founder's own, from the legacy site: the company does not
 * manufacture, it selects. That is also the honest commercial difference from
 * a shop, so it earns the largest type on the page after the h1.
 *
 * Every figure here is verified. The reference count is read from the catalogue
 * repository rather than typed, so it cannot drift away from the truth as the
 * catalogue grows.
 */
@Component({
  selector: 'fk-statement-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, RevealDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="container--wide statement__inner">
        <p class="statement__thesis" fkReveal>{{ t('home.statement.thesis') }}</p>

        <p class="statement__body" fkReveal [revealDelay]="80">
          {{ t('home.statement.body') }}
        </p>

        <dl class="statement__facts" fkReveal="stagger" revealChildren=".statement__fact">
          <div class="statement__fact">
            <dt class="statement__fact-value u-nums">{{ t('home.statement.founded') }}</dt>
            <dd class="statement__fact-label">{{ t('home.statement.foundedLabel') }}</dd>
          </div>
          <div class="statement__fact">
            <dt class="statement__fact-value u-nums">3</dt>
            <dd class="statement__fact-label">{{ t('home.statement.divisionsLabel') }}</dd>
          </div>
          <div class="statement__fact">
            <dt class="statement__fact-value u-nums">{{ referenceCount() }}</dt>
            <dd class="statement__fact-label">{{ t('home.statement.referencesLabel') }}</dd>
          </div>
        </dl>
      </div>
    </ng-container>
  `,
  styles: `
    @use '../../../../styles/abstracts/mixins' as *;

    :host {
      display: block;
      background-color: var(--surface-page);
      color: var(--text-primary);
      /* Quiet is a change of pace, not an empty screen. The first version gave
         this block nearly a full viewport and the restraint read as an
         unfinished page instead of a held breath. */
      padding-block: clamp(2rem, 6vw, 4.5rem) clamp(1.5rem, 4vw, 3rem);
    }

    .statement__inner {
      display: grid;
      gap: clamp(1.5rem, 3vw, 2.25rem);

      @include bp(lg) {
        // Thesis left, explanation right, figures across the foot. One compact
        // band rather than three widely separated ones.
        grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
        gap: clamp(1.75rem, 3vw, 2.75rem) clamp(2rem, 5vw, 5rem);
        align-items: start;
      }
    }

    .statement__thesis {
      @include display(clamp(1.875rem, 1.2rem + 2.4vw, 3.25rem));
      margin: 0;
      max-inline-size: 17ch;
      color: var(--text-primary);
    }

    .statement__body {
      margin: 0;
      font-size: var(--fs-lead);
      line-height: var(--lh-body);
      color: var(--text-secondary);
      max-inline-size: 46ch;

      @include bp(lg) {
        padding-block-start: 0.5rem;
      }
    }

    .statement__facts {
      display: flex;
      flex-wrap: wrap;
      gap: clamp(1.75rem, 5vw, 4rem);
      margin: 0;
      padding-block-start: clamp(1.25rem, 2.5vw, 1.75rem);
      border-block-start: 1px solid var(--border-hairline);

      @include bp(lg) {
        grid-column: 1 / -1;
      }
    }

    .statement__fact {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    /* The only other place on the page where a number is allowed to be large. */
    .statement__fact-value {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 1.3rem + 1.7vw, 2.75rem);
      font-weight: var(--fw-semibold);
      line-height: 1;
      letter-spacing: var(--ls-display);
      color: var(--text-primary);
    }

    .statement__fact-label {
      @include label;
      margin: 0;
    }
  `,
})
export class StatementSection {
  private readonly productRepo = inject(PRODUCT_REPOSITORY);

  private readonly products = toSignal(this.productRepo.all(), { initialValue: [] });

  /** Read from the catalogue, never typed, so the claim cannot go stale. */
  readonly referenceCount = computed(() => this.products().length);
}
