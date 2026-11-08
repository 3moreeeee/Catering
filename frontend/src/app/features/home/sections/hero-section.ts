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

  private readonly allCategories = toSignal(inject(CATEGORY_REPOSITORY).all(), {
    initialValue: [],
  });
  /** The bar's own order: packaging comes before MONIN here. */
  readonly categories = computed(() =>
    BAR_ORDER.flatMap((id) => this.allCategories().filter((category) => category.id === id)),
  );
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

const BAR_ORDER: readonly CategoryId[] = ['food', 'packaging', 'monin', 'hygiene'];

/** Line drawings for the division bar, on a 24-unit grid. */
const HERO_CATEGORY_ICONS: Readonly<Record<CategoryId, string>> = {
  food: 'M3 20.5h18M5 20.5v-8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8M6 10.5V8h4v2.5M5 15h6M14 20.5v-6.5l1.5-2V9h3v3l1.5 2v6.5M15.5 9V7h3v2M14 16h6',
  packaging:
    'M7 3.5h10l2 3v14H5v-14l2-3ZM5 6.5h14M12 10.5c-2.2 1.2-2.2 4.6 0 6 2.2-1.4 2.2-4.8 0-6ZM12 10.5v6',
  monin:
    'M7 3h5M9 3v3M7 6h4a2 2 0 0 1 2 2v12.5H5V8a2 2 0 0 1 2-2ZM5 12h8M16 13h4l.5 7.5h-5L16 13ZM15.7 16h4.6',
  hygiene:
    'M6 13V7.5a1.2 1.2 0 0 1 2.4 0V12M8.4 12V5.5a1.2 1.2 0 0 1 2.4 0V12M10.8 12V6.5a1.2 1.2 0 0 1 2.4 0V13M13.2 13V9a1.2 1.2 0 0 1 2.4 0v6.5c0 3-2.2 5-5 5-2.4 0-3.7-1-5-3L3.4 14a1.2 1.2 0 0 1 1.9-1.4L6 13.5M18.5 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM20 9.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
};
