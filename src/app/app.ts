import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { SiteHeader } from './core/layout/site-header/site-header';
import { SiteFooter } from './core/layout/site-footer/site-footer';
import { LocaleService } from './core/i18n/locale.service';
import { SiteAssistant } from './shared/components/site-assistant/site-assistant';

/**
 * Application shell.
 *
 * Deliberately thin: header, a single `<main>` landmark, footer. The skip link
 * is the first focusable element in the document, as WCAG 2.2 requires.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TranslocoDirective, SiteHeader, SiteFooter, SiteAssistant],
  template: `
    <ng-container *transloco="let t">
      <a class="skip-link" href="#main-content">{{ t('nav.skipToContent') }}</a>

      <fk-site-header />

      <main id="main-content" tabindex="-1">
        <router-outlet />
      </main>

      @if (!isAdmin()) {
        <fk-site-footer />
        <fk-site-assistant />
      }
    </ng-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100svh;
    }
    main {
      flex: 1;
      /* Removes the focus ring from the programmatic skip-link target. */
      outline: none;
    }
  `,
})
export class App {
  // Injected here so the locale effect stays live for the whole app lifetime.
  private readonly locales = inject(LocaleService);
  private readonly router = inject(Router);
  protected readonly locale = this.locales.locale;
  protected readonly isAdmin = signal(false);

  constructor() {
    this.updateShell(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.updateShell(event.urlAfterRedirects));
  }

  private updateShell(url: string): void {
    this.isAdmin.set(/(?:^|\/)admin(?:\/|$|[?#])/.test(url));
  }
}
