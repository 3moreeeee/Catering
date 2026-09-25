import { Routes } from '@angular/router';
import { localeGuard } from './core/guards/locale.guard';
import { LOCALES } from './shared/models/localized-text.model';
import { adminGuard, authGuard } from './core/auth/auth.guard';

/**
 * Every content route lives under `/:lang`. The locale is part of the URL so
 * each page is independently shareable, crawlable and server-renderable in the
 * correct language.
 *
 * All routes are lazily loaded — the initial bundle contains the shell and the
 * requested page only.
 */
export const routes: Routes = [
  {
    path: ':lang',
    canActivate: [localeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'about',
        loadComponent: () => import('./features/about/about.page').then((m) => m.AboutPage),
      },
      {
        path: 'products',
        loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage),
      },
      {
        // Declared before `products/:category` so that
        // `/products/food/mojito-mint` is not swallowed by the category route.
        path: 'products/:category/:slug',
        loadComponent: () =>
          import('./features/product-details/product-details.page').then(
            (m) => m.ProductDetailsPage,
          ),
      },
      {
        path: 'products/:category',
        loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage),
      },
      {
        path: 'brands',
        loadComponent: () => import('./features/brands/brands.page').then((m) => m.BrandsPage),
      },
      {
        path: 'industries',
        loadComponent: () =>
          import('./features/industries/industries.page').then((m) => m.IndustriesPage),
      },
      {
        path: 'contact',
        loadComponent: () => import('./features/contact/contact.page').then((m) => m.ContactPage),
      },
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'account',
        canActivate: [authGuard],
        loadComponent: () => import('./features/account/account.page').then((m) => m.AccountPage),
      },
      {
        // The panier is not guarded: an anonymous visitor reaching it is shown
        // an explanation and a sign-in link rather than being bounced, because
        // the link is visible in the header before they have an account.
        path: 'cart',
        loadComponent: () => import('./features/cart/cart.page').then((m) => m.CartPage),
      },
      {
        // One back-office frame; each section is a child route so it has its
        // own URL. /admin/users is unchanged for existing bookmarks.
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin-shell.page').then((m) => m.AdminShellPage),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/admin/admin-overview.page').then((m) => m.AdminOverviewPage),
          },
          {
            path: 'products',
            loadComponent: () =>
              import('./features/admin/products-admin.page').then((m) => m.ProductsAdminPage),
          },
          {
            path: 'quotes',
            loadComponent: () =>
              import('./features/admin/quotes-admin.page').then((m) => m.QuotesAdminPage),
          },
          {
            path: 'offers',
            loadComponent: () =>
              import('./features/admin/offers-admin.page').then((m) => m.OffersAdminPage),
          },
          {
            path: 'users',
            loadComponent: () =>
              import('./features/admin/users-admin.page').then((m) => m.UsersAdminPage),
          },
        ],
      },
      {
        path: 'privacy',
        loadComponent: () => import('./features/legal/privacy.page').then((m) => m.PrivacyPage),
      },
      {
        path: 'terms',
        loadComponent: () => import('./features/legal/terms.page').then((m) => m.TermsPage),
      },
      {
        path: '404',
        loadComponent: () => import('./features/legal/not-found.page').then((m) => m.NotFoundPage),
      },
      { path: '**', redirectTo: '404' },
    ],
  },
  // Bare `/` — locale negotiated from Accept-Language on the server and from
  // navigator.language in the browser.
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./core/i18n/locale-redirect.component').then((m) => m.LocaleRedirectComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./core/i18n/locale-redirect.component').then((m) => m.LocaleRedirectComponent),
  },
];

/** Static route paths, used to build the sitemap and the prerender list. */
export const STATIC_PATHS = [
  '',
  'about',
  'products',
  'products/food',
  'products/packaging',
  'products/hygiene',
  'brands',
  'industries',
  'contact',
  'privacy',
  'terms',
] as const;

export const ROUTE_LOCALES = LOCALES;
