import { InjectionToken } from '@angular/core';

// Defined by the Angular build: false in production builds, which lets the
// development URL below be removed from the production bundle entirely.
declare const ngDevMode: unknown;

/**
 * Base URL of the Spring Boot API.
 *
 * Development (`ng serve`) talks to the local backend directly. A production
 * build calls `/api` on its own origin, which the host forwards to the backend
 * (see vercel.json). Same-origin requests are what let the backend's
 * `SameSite=Strict` session cookie work at all: a browser never sends it to
 * another site. On the server, Angular resolves the relative URL against the
 * incoming request, so server rendering goes through the same forwarding.
 */
export const IDENTITY_API_URL = new InjectionToken<string>('IDENTITY_API_URL', {
  providedIn: 'root',
  factory: () =>
    typeof ngDevMode === 'undefined' || ngDevMode ? 'http://localhost:8081/api' : '/api',
});
