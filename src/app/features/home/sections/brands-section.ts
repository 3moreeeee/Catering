import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { BRAND_REPOSITORY } from '../../../data/repositories/catalog.repository';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { RevealDirective } from '../../../core/motion/reveal.directive';

/** Responsive brand index sourced from Vinto's published portfolio. */
@Component({
  selector: 'fk-brands-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, RevealDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="container--wide brands__inner">
        <header class="brands__head" fkReveal>
          <p class="u-eyebrow">{{ t('home.brands.eyebrow') }}</p>
          <h2 class="brands__title">{{ t('home.brands.title') }}</h2>
        </header>

        <ul class="brands__list" fkReveal="stagger" revealChildren=".brands__item">
          @for (brand of brands(); track brand.id; let i = $index) {
            <li class="brands__item">
              <a class="brands__link" [routerLink]="to('brands')" [fragment]="brand.slug">
                <span class="brands__num u-nums" aria-hidden="true">{{ ordinal(i) }}</span>

                <span class="brands__logo-frame">
                  <img class="brands__logo" [src]="brand.logo" [alt]="brand.name" width="180" height="64" />
                </span>

                <span class="brands__meta">
                  <span class="brands__origin">
                    @if (brand.country) {
                      {{ brand.country | localized }}
                    }
                  </span>
                  <span class="brands__desc">{{ brand.description | localized }}</span>
                </span>
              </a>
            </li>
          }
        </ul>

        <a class="link link--accent brands__all" [routerLink]="to('brands')">
          {{ t('home.brands.viewAll') }}
          <span class="link__arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </ng-container>
  `,
  styles: `
    @use '../../../../styles/abstracts/mixins' as *;

    :host {
      display: block;
      background-color: var(--surface-page);
      padding-block: clamp(2.5rem, 7vw, 6rem);
    }

    .brands__head {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      margin-block-end: clamp(2rem, 4vw, 3rem);
    }

    .brands__title {
      @include display(clamp(1.625rem, 1.2rem + 1.5vw, 2.375rem));
      margin: 0;
      max-inline-size: 22ch;
    }

    .brands__list {
      display: grid;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
      border-block-start: 1px solid var(--border-hairline);

      @include bp(md) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        border-block-start: 1px solid var(--border-hairline);
      }

      @include bp(lg) {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    .brands__item {
      border-block-end: 1px solid var(--border-hairline);

      @include bp(md) {
        border-block-end: 0;
        border-inline-end: 1px solid var(--border-hairline);

        &:nth-child(2n) {
          border-inline-end: 0;
        }
      }

      @include bp(lg) {
        border-inline-end: 1px solid var(--border-hairline);

        &:nth-child(2n) { border-inline-end: 1px solid var(--border-hairline); }
        &:nth-child(4n) { border-inline-end: 0; }
      }
    }

    .brands__link {
      @include focusable;
      display: grid;
      /* Keep each entry anchored to the top of its grid track. */
      align-content: start;
      gap: var(--sp-4);
      block-size: 100%;
      padding-block: clamp(1.125rem, 3vw, 2.25rem);
      padding-inline-end: clamp(1rem, 3vw, 2.5rem);
      color: inherit;
      text-decoration: none;

      @include bp(md) {
        &:not(:first-child) {
          padding-inline-start: clamp(1rem, 3vw, 2.5rem);
        }
      }
    }

    .brands__item + .brands__item .brands__link {
      @include bp(md) {
        padding-inline-start: clamp(1rem, 3vw, 2.5rem);
      }
    }

    .brands__num {
      @include label;
      color: var(--text-accent);
    }

    .brands__logo-frame {
      display: grid;
      place-items: center start;
      min-block-size: 4.5rem;
    }

    .brands__logo {
      display: block;
      inline-size: min(11.25rem, 100%);
      block-size: 4rem;
      background: transparent;
      object-fit: contain;
      object-position: left center;
      transition: transform var(--duration-base) var(--ease-standard);
    }

    .brands__link:hover .brands__logo {
      transform: translateY(-2px) scale(1.025);
    }

    .brands__meta {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .brands__origin {
      @include label;
      color: var(--text-muted);
      min-block-size: 1lh;
    }

    .brands__desc {
      font-size: var(--fs-sm);
      line-height: var(--lh-snug);
      color: var(--text-secondary);
      max-inline-size: 42ch;
    }

    .brands__all {
      display: inline-flex;
      margin-block-start: clamp(1.75rem, 3vw, 2.5rem);
    }

    @include motion-reduce {
      .brands__mark img {
        transition: none;
      }
    }
  `,
})
export class BrandsSection {
  private readonly links = inject(LocalizedRouter);
  private readonly brandRepo = inject(BRAND_REPOSITORY);

  readonly brands = toSignal(this.brandRepo.all(), { initialValue: [] });

  ordinal(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
