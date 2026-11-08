import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { BRAND_REPOSITORY } from '../../../data/repositories/catalog.repository';

/** "Nos marques": a quiet band of the real brand logos, each opening its brand entry. */
@Component({
  selector: 'fk-brands-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <section class="container brands-wrap" aria-labelledby="home-brands-title">
        <div class="brands">
          <h2 id="home-brands-title" class="brands__title">{{ t('home.brands.heading') }}</h2>

          <div class="brands__intro">
            <p>{{ t('home.brands.bandLead') }}</p>
            <a class="brands__all" [routerLink]="to('brands')">
              {{ t('home.brands.viewAll') }} <span aria-hidden="true">›</span>
            </a>
          </div>

          <ul class="brands__list">
            @for (brand of brands(); track brand.id) {
              <li>
                <a class="brands__tile" [routerLink]="to('brands')" [fragment]="brand.slug">
                  <img
                    [src]="brand.logo"
                    [alt]="brand.name"
                    width="180"
                    height="64"
                    loading="lazy"
                  />
                </a>
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
      background-color: var(--surface-page);
    }

    .brands-wrap {
      padding-block: clamp(1rem, 2vw, 1.5rem);
    }

    .brands {
      display: grid;
      gap: var(--sp-4) var(--sp-8);
      padding: clamp(1.25rem, 2.5vw, 2rem);
      border-radius: var(--r-md);
      background-color: var(--c-warm-100);

      @include bp(xl) {
        grid-template-columns: auto minmax(11rem, 16rem) minmax(0, 1fr);
        align-items: center;
      }
    }

    .brands__title {
      @include display(clamp(1.625rem, 1.2rem + 1.5vw, 2.5rem));
      margin: 0;
      color: var(--c-teal-900);
      white-space: nowrap;
    }

    .brands__intro {
      color: var(--text-secondary);
      font-size: var(--fs-sm);
      line-height: var(--lh-snug);

      @include bp(xl) {
        padding-inline-start: var(--sp-8);
        border-inline-start: 1px solid var(--border-neutral);
      }

      p {
        margin: 0;
      }
    }

    .brands__all {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      min-block-size: var(--tap-min);
      color: var(--c-teal-900);
      font-weight: var(--fw-semibold);
      text-underline-offset: 0.25em;

      @include focusable;
    }

    .brands__list {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--sp-2);
      margin: 0;
      padding: 0;
      list-style: none;

      @include bp(md) {
        grid-template-columns: repeat(7, minmax(0, 1fr));
      }
    }

    .brands__tile {
      display: grid;
      place-items: center;
      block-size: 4rem;
      padding: var(--sp-2);
      border: 1px solid transparent;
      border-radius: var(--r-sm);
      background-color: var(--c-white);
      transition: border-color var(--d-fast) var(--ease-out);

      @include focusable;

      &:hover {
        border-color: var(--c-teal-900);
      }

      img {
        inline-size: 100%;
        block-size: 100%;
        object-fit: contain;
        background: none;
      }
    }
  `,
})
export class BrandsSection {
  private readonly links = inject(LocalizedRouter);
  readonly brands = toSignal(inject(BRAND_REPOSITORY).all(), { initialValue: [] });

  to(path: string): string[] {
    return this.links.path(path);
  }
}
