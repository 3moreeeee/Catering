/** The two locales the site supports. */
export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/**
 * Every user-facing string that originates from the catalogue (rather than the
 * UI translation files) carries both locales inline. This keeps a product's
 * copy with the product, which is how every headless CMS models it too — so the
 * shape survives the migration from mock data to a real API unchanged.
 */
export interface LocalizedText {
  readonly en: string;
  readonly fr: string;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Resolves a localized value, falling back to the other locale if one is empty. */
export function resolveLocalized(text: LocalizedText, locale: Locale): string {
  const primary = text[locale];
  if (primary.length > 0) {
    return primary;
  }
  return locale === 'en' ? text.fr : text.en;
}
