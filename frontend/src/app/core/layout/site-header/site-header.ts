import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  HostListener,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocaleService } from '../../i18n/locale.service';
import { LocalizedRouter } from '../../i18n/localized-router.service';
import {
  CATEGORY_REPOSITORY,
  PRODUCT_REPOSITORY,
} from '../../../data/repositories/catalog.repository';
import { Locale } from '../../../shared/models/localized-text.model';
import { MegaMenu } from '../mega-menu/mega-menu';
import { MobileNav } from '../mobile-nav/mobile-nav';
import { AuthService } from '../../auth/auth.service';
import { CartService } from '../../cart/cart.service';

/**
 * Sticky header.
 *
 * Works over both light and dark grounds: the homepage hero is dark, so the
 * header starts transparent-on-dark and swaps to a solid ivory bar once the
 * user scrolls past the hero. The swap is driven by a scroll threshold rather
 * than by which route is active, so it is correct on every page.
 */
@Component({
  selector: 'fk-site-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslocoDirective, UpperCasePipe, MegaMenu, MobileNav],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  host: {
    // Custom element hosts carry no implicit landmark role.
    role: 'banner',
    '[class.is-scrolled]': 'scrolled()',
    '[class.is-transparent]': 'transparent()',
  },
})
export class SiteHeader {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly locales = inject(LocaleService);
  private readonly links = inject(LocalizedRouter);
  private readonly categoryRepo = inject(CATEGORY_REPOSITORY);
  private readonly productRepo = inject(PRODUCT_REPOSITORY);
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);

  readonly categories = toSignal(this.categoryRepo.all(), { initialValue: [] });
  readonly totalProducts = toSignal(this.productRepo.all().pipe(), { initialValue: [] });

  readonly productCount = computed(() => this.totalProducts().length);

  readonly scrolled = signal(false);
  readonly megaOpen = signal(false);
  readonly mobileOpen = signal(false);

  private readonly burger = viewChild<ElementRef<HTMLButtonElement>>('burger');
  /** True once the drawer has been opened at least once in this session. */
  private hasOpened = false;

  /** The header floats over the hero on dark-hero routes until the user scrolls. */
  readonly transparent = computed(() => this.hasDarkHero() && !this.scrolled());

  private readonly currentUrl = signal(this.router.url);

  readonly locale = this.locales.locale;
  readonly alternate = this.locales.alternate;

  constructor() {
    // The badge has to be right on first paint of any page, so the header -
    // the one component present on every route - is what loads the panier.
    void this.cart.refresh();

    this.router.events.subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.megaOpen.set(false);
      this.mobileOpen.set(false);
    });

    // Focus goes back to the control that opened the drawer, whichever way it
    // closed — the close button, the backdrop, Escape or a route change. The
    // CDK focus trap restores focus itself when it is torn down by a button
    // press inside it, but not when the drawer is closed by something that was
    // never inside it, and a keyboard user left at the top of the document has
    // lost their place in the page.
    afterRenderEffect(() => {
      if (this.mobileOpen()) {
        this.hasOpened = true;
        return;
      }
      if (!this.hasOpened) {
        return;
      }
      this.burger()?.nativeElement.focus({ preventScroll: true });
    });
  }

  /**
   * Routes whose first section is a dark full-bleed hero the header floats over.
   * Everything else gets the solid ivory bar from the first pixel.
   */
  private hasDarkHero(): boolean {
    const path = this.currentUrl().split('?')[0] ?? '';
    return /^\/(en|fr)(\/(about)?)?\/?$/.test(path);
  }

  @HostListener('document:scroll')
  onScroll(): void {
    const y = this.document.defaultView?.scrollY ?? 0;
    this.scrolled.set(y > 24);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.megaOpen.set(false);
  }

  home(): string[] {
    return this.links.path('');
  }
  to(path: string): string[] {
    return this.links.path(path);
  }

  accountPath(): string[] {
    return this.links.path(
      this.auth.isAdmin() ? 'admin' : this.auth.authenticated() ? 'account' : 'login',
    );
  }

  switchLocaleUrl(target: Locale): string {
    return this.links.switchLocaleUrl(target);
  }

  toggleMega(): void {
    this.megaOpen.update((open) => !open);
  }

  closeMega(): void {
    this.megaOpen.set(false);
  }

  toggleMobile(): void {
    this.mobileOpen.update((open) => !open);
  }

  /** Href the search form posts to without JavaScript. */
  readonly searchAction = computed(() => this.links.path('products').join('/').replace('//', '/'));

  /**
   * Sends the query to the catalogue, which already owns search, filtering and
   * URL state. The form has a real `action` and a real `method="get"`, so it
   * works before hydration and without JavaScript; this handler only upgrades
   * that to a client-side navigation when scripting is available.
   */
  submitSearch(event: Event, term: string): void {
    event.preventDefault();
    const q = term.trim();
    void this.router.navigate(this.links.path('products'), {
      queryParams: { q: q || null },
    });
  }
}
