import { InjectionToken } from '@angular/core';

/** Override this token at deployment when the identity API uses another origin. */
export const IDENTITY_API_URL = new InjectionToken<string>('IDENTITY_API_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8081/api',
});
