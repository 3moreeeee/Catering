import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import {
  CATEGORY_REPOSITORY,
  PRODUCT_REPOSITORY,
} from '../../../data/repositories/catalog.repository';
import { CategoryId, Product } from '../../../shared/models/catalog.model';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { HERO_SLIDES, HeroSlide } from './hero-slides';

const AUTOPLAY_MS = 6000;
const SWIPE_THRESHOLD_PX = 48;

/**
 * Promotional carousel and the four division links.
 *
 * Every slide's text and link is server-rendered; banner images are mounted
 * only for the first slide and, once running in the browser, for the current
 * slide's neighbours, so one full-size banner is fetched on first paint.
 */
@Component({
  selector: 'fk-hero-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe],
  templateUrl: './hero-section.html',
  styleUrl: './hero-section.scss',
})
export class HeroSection implements OnDestroy {
  private readonly links = inject(LocalizedRouter);
  private readonly document = inject(DOCUMENT);

  readonly categories = toSignal(inject(CATEGORY_REPOSITORY).all(), { initialValue: [] });
  readonly slides = HERO_SLIDES;

  /** Null for a slug the catalogue no longer has; empty until the lookups answer. */
  private readonly productRepo = inject(PRODUCT_REPOSITORY);
  private readonly products = toSignal(
    forkJoin(HERO_SLIDES.map((s) => this.productRepo.byProductSlug(s.productSlug))),
    { initialValue: [] as (Product | null)[] },
  );

  readonly active = signal(0);
  readonly userPaused = signal(false);
  readonly reducedMotion = signal(false);
  private readonly hovered = signal(false);
  private readonly keyboardFocus = signal(false);
  private readonly pageVisible = signal(true);
  private readonly inBrowser = signal(false);

  readonly autoplaying = computed(
    () =>
      this.inBrowser() &&
      this.pageVisible() &&
      !this.reducedMotion() &&
      !this.userPaused() &&
      !this.hovered() &&
      !this.keyboardFocus(),
  );

  /** Slides whose banner is mounted. Starts with the first only, on both server and client. */
  readonly mounted = computed(() => {
    const active = this.active();
    const total = this.slides.length;
    const indexes = new Set([0, active]);
    if (this.inBrowser()) {
      indexes.add((active + 1) % total);
      indexes.add((active - 1 + total) % total);
    }
    return indexes;
  });

  private touchStartX: number | null = null;

  constructor() {
    afterNextRender(() => {
      const view = this.document.defaultView;
      this.reducedMotion.set(view?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false);
      this.pageVisible.set(this.document.visibilityState === 'visible');
      this.document.addEventListener('visibilitychange', this.onVisibility);
      this.inBrowser.set(true);
    });

    // Re-armed on every slide change, so a manual move always gets a full interval.
    effect((onCleanup) => {
      this.active();
      if (!this.autoplaying()) return;
      const timer = setTimeout(() => this.next(), AUTOPLAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = (): void => {
    this.pageVisible.set(this.document.visibilityState === 'visible');
  };

  next(): void {
    this.active.update((i) => (i + 1) % this.slides.length);
  }

  previous(): void {
    this.active.update((i) => (i - 1 + this.slides.length) % this.slides.length);
  }

  togglePause(): void {
    this.userPaused.update((paused) => !paused);
  }

  setHovered(value: boolean): void {
    this.hovered.set(value);
  }

  /** Only keyboard focus pauses: a clicked arrow keeps focus and must not stop the carousel. */
  onFocusIn(event: FocusEvent): void {
    this.keyboardFocus.set((event.target as HTMLElement).matches(':focus-visible'));
  }

  onFocusOut(event: FocusEvent): void {
    const stage = event.currentTarget as HTMLElement;
    if (!stage.contains(event.relatedTarget as Node | null)) this.keyboardFocus.set(false);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? null;
  }

  onTouchEnd(event: TouchEvent): void {
    const end = event.changedTouches[0]?.clientX;
    if (this.touchStartX === null || end === undefined) return;
    const delta = end - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) this.next();
    else this.previous();
  }

  /** The product page, or its division when the catalogue no longer lists the product. */
  slideLink(slide: HeroSlide, index: number): string[] {
    const missing = this.products()[index] === null;
    return this.to(
      missing
        ? `products/${slide.categoryId}`
        : `products/${slide.categoryId}/${slide.productSlug}`,
    );
  }

  to(path: string): string[] {
    return this.links.path(path);
  }

  icon(id: CategoryId): string {
    return HERO_CATEGORY_ICONS[id];
  }
}

/** Stroke paths for the division links, drawn on a 24-unit grid. */
const HERO_CATEGORY_ICONS: Readonly<Record<CategoryId, string>> = {
  food: 'M4 10h16l-1.6 9.5H5.6L4 10Zm3 0 3.5-6M17 10l-3.5-6M9.5 13.5v3M14.5 13.5v3',
  monin: 'M10 2.5h4v3l1.5 3V21h-7V8.5L10 5.5v-3ZM8.5 13h7',
  packaging: 'M12 3 20.5 7.5v9L12 21l-8.5-4.5v-9L12 3Zm0 9 8.5-4.5M12 12 3.5 7.5M12 12v9',
  hygiene: 'M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3Z',
};
