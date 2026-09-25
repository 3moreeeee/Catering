import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';

/**
 * The back-office frame: one heading, one tab bar, and the active section.
 *
 * Every section is a child route rather than a tab held in component state, so
 * each one has its own URL, survives a reload and can be linked to directly —
 * "/fr/admin/quotes" is something an administrator can bookmark.
 */
@Component({
  selector: 'fk-admin-shell-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <section class="account-page admin-page">
        <div class="admin-layout">
          <aside class="admin-sidebar">
            <a class="admin-brand" [routerLink]="to('admin')">
              <img
                src="/img/logo-on-dark.png"
                width="700"
                height="157"
                alt="Ferid Khemakhem Catering"
              />
              <span>Back office</span>
            </a>
            <nav class="admin-tabs" [attr.aria-label]="t('dashboard.navigation')">
              @for (tab of tabs; track tab.path) {
                <a
                  class="admin-tabs__link"
                  [routerLink]="to(tab.path)"
                  routerLinkActive="is-active"
                  [routerLinkActiveOptions]="{ exact: tab.exact }"
                  ariaCurrentWhenActive="page"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    @switch (tab.icon) {
                      @case ('dashboard') {
                        <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" />
                      }
                      @case ('products') {
                        <path
                          d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 2.3L7 8l5 2.7L17 8l-5-2.7Zm-6 4.4v5.6l5 2.8v-5.7L6 9.7Zm7 8.4 5-2.8V9.7l-5 2.7v5.7Z"
                        />
                      }
                      @case ('offers') {
                        <path
                          d="M21 12 12 3H5a2 2 0 0 0-2 2v7l9 9 9-9ZM7.5 9A1.5 1.5 0 1 1 7.5 6a1.5 1.5 0 0 1 0 3Z"
                        />
                      }
                      @case ('quotes') {
                        <!-- Fill-designed, like its four siblings: the ruled
                             lines are cut out of the sheet rather than drawn
                             as open strokes, which a fill would collapse. -->
                        <path
                          fill-rule="evenodd"
                          d="M14 2H6v20h14V8h-6V2Zm2 .4L19.6 6H16V2.4ZM8.5 11.5h9V13h-9v-1.5Zm0 4h9V17h-9v-1.5Z"
                        />
                      }
                      @case ('users') {
                        <path
                          d="M16 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM8 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1c-3.3 0-6 1.8-6 4v3h12v-3c0-2.2-2.7-4-6-4ZM8 15c-3.3 0-6 1.8-6 4v2h6v-3c0-1 .4-2 1.1-2.8L8 15Z"
                        />
                      }
                    }
                  </svg>
                  <span>{{ t(tab.label) }}</span>
                </a>
              }
            </nav>
            <div class="admin-sidebar__footer">
              <span class="admin-avatar">{{ initials() }}</span>
              <span class="admin-person"
                ><strong>{{ auth.displayName() }}</strong
                ><small>{{ t('auth.roles.admin') }}</small></span
              >
              <a
                class="admin-account-link"
                [routerLink]="to('account')"
                [attr.aria-label]="t('admin.back')"
                >→</a
              >
            </div>
          </aside>

          <main class="admin-workspace">
            <header class="admin-topbar">
              <div>
                <p class="u-eyebrow">{{ t('admin.eyebrow') }}</p>
                <h1>{{ t('dashboard.title') }}</h1>
                <p>{{ t('dashboard.lead', { name: auth.displayName() }) }}</p>
              </div>
            </header>
            <div class="admin-content"><router-outlet /></div>
          </main>
        </div>
      </section>
    </ng-container>
  `,
})
export class AdminShellPage {
  private readonly links = inject(LocalizedRouter);
  readonly auth = inject(AuthService);

  readonly tabs = [
    { path: 'admin', label: 'dashboard.tabs.overview', icon: 'dashboard', exact: true },
    { path: 'admin/products', label: 'dashboard.tabs.products', icon: 'products', exact: false },
    { path: 'admin/offers', label: 'dashboard.tabs.offers', icon: 'offers', exact: false },
    { path: 'admin/quotes', label: 'dashboard.tabs.quotes', icon: 'quotes', exact: false },
    { path: 'admin/users', label: 'dashboard.tabs.users', icon: 'users', exact: false },
  ] as const;

  initials(): string {
    return (
      this.auth
        .displayName()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'A'
    );
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
