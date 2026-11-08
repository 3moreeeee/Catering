import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { forkJoin, map } from 'rxjs';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { PRODUCT_REPOSITORY } from '../../../data/repositories/catalog.repository';
import { CATEGORY_IDS, Product } from '../../../shared/models/catalog.model';
import { ProductCard } from '../../../shared/components/cards/product-card';
import { CAMPAIGN_EXCLUDED_BRANDS } from './hero-slides';

const PER_DIVISION = 3;
/** Fetched per division so the selection still fills after the exclusions above. */
const FETCH_PER_DIVISION = 8;
/** Pages at desktop width: twelve products, four per view. */
const DEFAULT_PAGES = 3;

/**
 * "À découvrir dans le catalogue": a scrolling row of real products, drawn in
 * turn from each division. Native scroll-snap does the moving; the arrows and
 * dots only drive and report it.
 */
@Component({
  selector: 'fk-featured-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, ProductCard],
  templateUrl: './featured-section.html',
  styleUrl: './featured-section.scss',
})
export class FeaturedSection {
  private readonly links = inject(LocalizedRouter);
  private readonly productRepo = inject(PRODUCT_REPOSITORY);

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  readonly products = toSignal(
    forkJoin(CATEGORY_IDS.map((id) => this.productRepo.featured(FETCH_PER_DIVISION, id))).pipe(
      map((divisions) => interleave(divisions.map(selectForCampaign))),
    ),
    { initialValue: [] as readonly Product[] },
  );

  readonly page = signal(0);
  readonly pageCount = signal(DEFAULT_PAGES);
  readonly pages = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i));

  constructor() {
    afterNextRender(() => this.measure());
  }

  measure(): void {
    const el = this.track()?.nativeElement;
    if (!el || el.clientWidth === 0) return;
    this.pageCount.set(Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.02)));
    this.page.set(Math.min(this.pageCount() - 1, Math.round(el.scrollLeft / el.clientWidth)));
  }

  goTo(page: number): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    const last = this.pageCount() - 1;
    const target = page < 0 ? last : page > last ? 0 : page;
    el.scrollTo({ left: target * el.clientWidth });
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}

function selectForCampaign(products: readonly Product[]): readonly Product[] {
  return products
    .filter((p) => p.images.length > 0 && !(p.brandId && CAMPAIGN_EXCLUDED_BRANDS.has(p.brandId)))
    .slice(0, PER_DIVISION);
}

/** First of each division, then second of each, so neighbouring cards differ. */
function interleave(divisions: readonly (readonly Product[])[]): readonly Product[] {
  const result: Product[] = [];
  for (let round = 0; round < PER_DIVISION; round++) {
    for (const division of divisions) {
      const product = division[round];
      if (product) result.push(product);
    }
  }
  return result;
}
