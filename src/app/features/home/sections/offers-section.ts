import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import {
  CATEGORY_REPOSITORY,
  PRODUCT_REPOSITORY,
} from '../../../data/repositories/catalog.repository';
import { Product } from '../../../shared/models/catalog.model';
import { FrenchTypographyPipe } from '../../../shared/pipes/french-typography.pipe';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';

/** Live and upcoming Neon promotions, placed directly after the homepage showcase. */
@Component({
  selector: 'fk-offers-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, FrenchTypographyPipe],
  template: `
    <ng-container *transloco="let t">
      @if (offers().length) {
        <section class="offers" [attr.aria-labelledby]="'home-offers-title'">
          <div class="container offers__inner">
            <header class="offers__head">
              <div>
                <p class="u-eyebrow">{{ t('home.offers.eyebrow') }}</p>
                <h2 id="home-offers-title">{{ t('home.offers.title') }}</h2>
              </div>
              <div class="offers__head-side">
                <p>{{ t('home.offers.lead') }}</p>
                @if (offers().length > 1) {
                  <div class="offers__controls">
                    <button
                      type="button"
                      (click)="previous()"
                      [attr.aria-label]="t('home.offers.previous')"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      (click)="next()"
                      [attr.aria-label]="t('home.offers.next')"
                    >
                      →
                    </button>
                  </div>
                }
              </div>
            </header>

            <ul
              #track
              class="offers__grid"
              aria-live="off"
              (mouseenter)="pause()"
              (mouseleave)="resume()"
              (focusin)="pause()"
              (focusout)="resume()"
            >
              @for (product of offers(); track product.id) {
                <li>
                  <article class="offer-card">
                    <a class="offer-card__media" [routerLink]="productLink(product)">
                      @if (product.images[0]; as image) {
                        <img
                          [src]="image.src"
                          [alt]="image.alt | localized"
                          [width]="image.width"
                          [height]="image.height"
                          loading="lazy"
                        />
                      }
                      <span class="offer-card__discount">−{{ discount(product) }}%</span>
                    </a>
                    <div class="offer-card__body">
                      <span
                        class="offer-card__status"
                        [class.is-live]="product.offer!.currentlyActive"
                      >
                        {{
                          product.offer!.currentlyActive
                            ? t('home.offers.live')
                            : t('home.offers.scheduled')
                        }}
                      </span>
                      <h3>{{ product.name | localized | frenchType }}</h3>
                      <p class="offer-card__price u-nums">
                        <del>{{
                          money(product.offer!.originalPrice, product.offer!.currency)
                        }}</del>
                        <strong>{{ money(product.offer!.price, product.offer!.currency) }}</strong>
                      </p>
                      @if (!product.offer!.currentlyActive && product.offer!.startsAt) {
                        <p class="offer-card__date">
                          {{ t('home.offers.starts', { date: date(product.offer!.startsAt!) }) }}
                        </p>
                      } @else if (product.offer!.endsAt) {
                        <p class="offer-card__date">
                          {{ t('home.offers.ends', { date: date(product.offer!.endsAt!) }) }}
                        </p>
                      }
                      <a class="btn btn--primary" [routerLink]="productLink(product)">
                        {{ t('home.offers.viewProduct') }}
                      </a>
                    </div>
                  </article>
                </li>
              }
            </ul>
          </div>
        </section>
      }
    </ng-container>
  `,
  styleUrl: './offers-section.scss',
})
export class OffersSection implements AfterViewInit, OnDestroy {
  @ViewChild('track') private track?: ElementRef<HTMLElement>;

  private readonly products = toSignal(inject(PRODUCT_REPOSITORY).all(), { initialValue: [] });
  private readonly categories = toSignal(inject(CATEGORY_REPOSITORY).all(), { initialValue: [] });
  private readonly links = inject(LocalizedRouter);
  private readonly locale = inject(LocaleService);
  private readonly platformId = inject(PLATFORM_ID);
  private autoplayTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const offerCount = this.offers().length;
      if (offerCount > 1) queueMicrotask(() => this.resume());
      else this.pause();
    });
  }

  readonly offers = computed(() =>
    this.products()
      .filter((product) => {
        const offer = product.offer;
        return offer && (!offer.endsAt || new Date(offer.endsAt).getTime() > Date.now());
      })
      .sort((a, b) => Number(b.offer!.currentlyActive) - Number(a.offer!.currentlyActive)),
  );

  ngAfterViewInit(): void {
    this.resume();
  }

  ngOnDestroy(): void {
    this.pause();
  }

  previous(): void {
    this.move(-1);
  }

  next(): void {
    this.move(1);
  }

  pause(): void {
    if (this.autoplayTimer !== null) clearInterval(this.autoplayTimer);
    this.autoplayTimer = null;
  }

  resume(): void {
    if (
      !isPlatformBrowser(this.platformId) ||
      this.autoplayTimer !== null ||
      this.offers().length < 2 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    this.autoplayTimer = setInterval(() => this.next(), 4500);
  }

  private move(direction: -1 | 1): void {
    const element = this.track?.nativeElement;
    const firstCard = element?.firstElementChild as HTMLElement | null;
    if (!element || !firstCard) return;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    const step = firstCard.getBoundingClientRect().width + gap;
    const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - step / 2;
    const atStart = element.scrollLeft <= step / 2;

    if (direction === 1 && atEnd) {
      element.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (direction === -1 && atStart) {
      element.scrollTo({ left: element.scrollWidth, behavior: 'smooth' });
    } else {
      element.scrollBy({ left: direction * step, behavior: 'smooth' });
    }
  }

  discount(product: Product): number {
    const offer = product.offer!;
    return Math.round((1 - offer.price / offer.originalPrice) * 100);
  }

  money(value: number, currency: string): string {
    return `${value.toFixed(3)} ${currency}`;
  }

  date(value: string): string {
    return new Intl.DateTimeFormat(this.locale.locale(), { dateStyle: 'medium' }).format(
      new Date(value),
    );
  }

  productLink(product: Product): string[] {
    const category = this.categories().find((item) => item.id === product.categoryId);
    return this.links.path(`products/${category?.slug ?? product.categoryId}/${product.slug}`);
  }
}
