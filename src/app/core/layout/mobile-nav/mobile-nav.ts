import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { A11yModule } from '@angular/cdk/a11y';
import { LocalizedRouter } from '../../i18n/localized-router.service';
import { LocaleService } from '../../i18n/locale.service';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { Category } from '../../../shared/models/catalog.model';
import { COMPANY } from '../../../data/company.data';
import { AuthService } from '../../auth/auth.service';
import { CartService } from '../../cart/cart.service';

/**
 * Full-screen mobile navigation.
 *
 * Uses the CDK focus trap so a screen-reader or keyboard user cannot tab out of
 * the open drawer into the page behind it. Body scroll is locked while open,
 * and focus returns to the trigger on close (handled by `cdkTrapFocusAutoCapture`
 * plus the header retaining its button reference).
 */
@Component({
  selector: 'fk-mobile-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, A11yModule],
  templateUrl: './mobile-nav.html',
  styleUrl: './mobile-nav.scss',
  host: {
    '[class.is-open]': 'open()',
    '[attr.aria-hidden]': '!open()',
  },
})
export class MobileNav {
  readonly open = input.required<boolean>();
  readonly categories = input.required<readonly Category[]>();
  readonly dismiss = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly links = inject(LocalizedRouter);
  private readonly locales = inject(LocaleService);
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);

  readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  readonly company = COMPANY;
  readonly alternate = this.locales.alternate;

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      // Lock body scroll behind the drawer.
      this.document.body.style.overflow = this.open() ? 'hidden' : '';
    });

    // Every close path has to give the page back. The effect above covers the
    // ordinary ones — the close button, the backdrop, Escape, a route change —
    // but not the component being torn down while the drawer is open, which is
    // what happens on a full page navigation. Without this the next page loads
    // with a body that cannot scroll and no visible reason why.
    this.destroyRef.onDestroy(() => {
      this.document.body.style.overflow = '';
    });
  }

  /**
   * Escape closes the drawer.
   *
   * Bound on the document rather than the panel because the CDK focus trap can
   * park focus on its own invisible anchor elements, and a keydown there does
   * not bubble through the panel. The `open()` guard keeps this from competing
   * with any other Escape handler while the drawer is shut.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.dismiss.emit();
    }
  }

  to(path: string): string[] {
    return this.links.path(path);
  }

  switchLocaleUrl(): string {
    return this.links.switchLocaleUrl(this.alternate());
  }
}
