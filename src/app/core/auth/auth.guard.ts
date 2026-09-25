import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  // Authentication is resolved by the browser against the Spring API. Let SSR
  // render the shell instead of redirecting a valid cookie session prematurely.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  if (user) return true;
  const locale = state.url.split('/')[1] === 'en' ? 'en' : 'fr';
  return router.createUrlTree([locale, 'login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  const locale = state.url.split('/')[1] === 'en' ? 'en' : 'fr';
  if (!user) {
    return router.createUrlTree([locale, 'login'], { queryParams: { returnUrl: state.url } });
  }
  return user.role === 'ADMIN' ? true : router.createUrlTree([locale, 'account']);
};
