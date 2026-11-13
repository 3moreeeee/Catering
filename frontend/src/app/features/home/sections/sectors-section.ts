import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { PricingService } from '../../../core/cart/pricing.service';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { PRODUCT_REPOSITORY } from '../../../data/repositories/catalog.repository';
import { Product } from '../../../shared/models/catalog.model';
import { FrenchTypographyPipe } from '../../../shared/pipes/french-typography.pipe';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { PackText, packTermsOf } from '../../../shared/utils/pack-text.service';
import { uniformImageFit } from '../../../shared/utils/product-image-fit';

interface Hotspot {
  readonly slug: string;
  /** Where the product stands in the photograph, in percent. */
  readonly x: number;
  readonly y: number;
}

interface Scene {
  readonly key: string;
  /** i18n prefix holding title, lead, cta and alt. */
  readonly copy: string;
  /** Catalogue URL parameters of this trade's selection. */
  readonly params: Readonly<Record<string, string>>;
  /** File stem under /img/home/vitrine/v3: 1800px `.webp` and `-1000.webp`. */
  readonly image: string;
  readonly hotspots: readonly Hotspot[];
}

const SCENES: readonly Scene[] = [
  {
    key: 'restaurants',
    copy: 'home.sectors.cards.restaurants',
    params: { industry: 'restaurants' },
    image: 'restaurants',
    hotspots: [
      { slug: 'mayonnaise-mayor-riche-cremeuse-350-ml', x: 38, y: 49 },
      { slug: 'moutarde-de-dijon-dijona-200g', x: 70.9, y: 61 },
      { slug: 'sirop-de-fraise-monin-25cl', x: 88.2, y: 44 },
    ],
  },
  {
    key: 'hotels',
    copy: 'home.sectors.cards.hotels',
    params: { industry: 'hotels' },
    image: 'hotels',
    hotspots: [
      {
        slug: 'bol-a-salade-kraft-avec-couvercle',
        x: 41.2,
        y: 49,
      },
      { slug: 'gobelet-et-couvercle-en-pet-350ml', x: 64.1, y: 44 },
      { slug: 'puree-de-fruit-de-la-passion-monin', x: 73.9, y: 37 },
    ],
  },
  {
    key: 'industry',
    copy: 'home.sectors.cards.industry',
    params: { industry: 'food-production' },
    image: 'industry',
    hotspots: [
      { slug: 'gants-en-nitrile-bleus-boite-de-100', x: 49, y: 57 },
      { slug: 'coiffe-de-protection', x: 65.5, y: 54 },
      { slug: 'barquette-a-sushi-224x142x30mm', x: 87.3, y: 56 },
    ],
  },
  {
    key: 'idea',
    copy: 'home.sectors.idea',
    params: { q: 'verrine' },
    image: 'dessert',
    hotspots: [
      { slug: 'puree-de-fraise-monin-1-32-kg', x: 55.7, y: 27 },
      { slug: 'verrine-cube-100-ml', x: 65.5, y: 63 },
      { slug: 'cuillere-chinoise-transparente-ds02', x: 88.4, y: 84.5 },
    ],
  },
];

interface PlacedProduct extends Hotspot {
  readonly product: Product;
}

interface LoadedScene {
  readonly key: string;
  readonly placed: readonly PlacedProduct[];
}

/**
 * "La vitrine": one large photograph per trade, in the company's colours, with
 * its real products standing in it. A marker on each product opens its live
 * name, format and price; a product withdrawn from the catalogue simply loses
 * its marker. Phones, where markers would be too small, get the same products
 * as a list under the photograph.
 */
@Component({
  selector: 'fk-sectors-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, FrenchTypographyPipe],
  templateUrl: './sectors-section.html',
  styleUrl: './sectors-section.scss',
})
export class SectorsSection {
  private readonly links = inject(LocalizedRouter);
  private readonly repo = inject(PRODUCT_REPOSITORY);
  private readonly pricing = inject(PricingService);
  private readonly pack = inject(PackText);

  readonly scenes = SCENES;
  readonly activeKey = signal(SCENES[0]!.key);
  readonly openSlug = signal(SCENES[0]!.hotspots[0]!.slug);
  readonly current = computed(
    () => SCENES.find((scene) => scene.key === this.activeKey()) ?? SCENES[0]!,
  );

  private readonly loaded = new Map<string, LoadedScene>();
  private readonly latest = toSignal(
    toObservable(this.activeKey).pipe(switchMap((key) => this.load(key))),
    { initialValue: null },
  );

  /** The active scene's products, empty while they are on their way. */
  readonly placed = computed(() => {
    const scene = this.latest();
    return scene?.key === this.activeKey() ? scene.placed : [];
  });

  constructor() {
    // The other trades' products are fetched up front, so their markers are
    // there the moment a visitor switches.
    afterNextRender(() => {
      for (const scene of SCENES.slice(1)) this.load(scene.key).subscribe();
    });
  }

  private load(key: string): Observable<LoadedScene> {
    const known = this.loaded.get(key);
    if (known) return of(known);
    const scene = SCENES.find((candidate) => candidate.key === key) ?? SCENES[0]!;
    return forkJoin(scene.hotspots.map((spot) => this.repo.byProductSlug(spot.slug))).pipe(
      map((products) => ({
        key,
        placed: scene.hotspots.flatMap((spot, index) => {
          const product = products[index];
          return product ? [{ ...spot, product }] : [];
        }),
      })),
      tap((result) => this.loaded.set(key, result)),
    );
  }

  select(key: string): void {
    this.activeKey.set(key);
    const scene = SCENES.find((candidate) => candidate.key === key);
    if (scene) this.openSlug.set(scene.hotspots[0]!.slug);
  }

  /** The product's price as displayed, or null when none is published. */
  priceLabel(product: Product): string | null {
    const point = this.pricing.priceOf(product.id);
    return point ? this.pack.price(point.price, point.currency) : null;
  }

  isPack(product: Product): boolean {
    const point = this.pricing.priceOf(product.id);
    return packTermsOf(point) !== null && point?.price !== null;
  }

  fit(product: Product) {
    return uniformImageFit(product.images[0]);
  }

  link(product: Product): string[] {
    return this.links.path(`products/${product.categoryId}/${product.slug}`);
  }

  to(path: string): string[] {
    return this.links.path(path);
  }

  onTabKeydown(event: KeyboardEvent): void {
    const keys = SCENES.map((scene) => scene.key);
    const index = keys.indexOf(this.activeKey());
    const moves: Readonly<Record<string, number>> = {
      ArrowRight: (index + 1) % keys.length,
      ArrowLeft: (index - 1 + keys.length) % keys.length,
      Home: 0,
      End: keys.length - 1,
    };
    const next = keys[moves[event.key] ?? -1];
    if (!next) return;
    event.preventDefault();
    this.select(next);
    (event.currentTarget as HTMLElement)
      .closest('[role="tablist"]')
      ?.querySelector<HTMLButtonElement>(`#scene-tab-${next}`)
      ?.focus();
  }
}
