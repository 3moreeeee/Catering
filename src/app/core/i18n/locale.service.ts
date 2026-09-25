import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  DEFAULT_LOCALE,
  LOCALES,
  Locale,
  LocalizedText,
  isLocale,
  resolveLocalized,
} from '../../shared/models/localized-text.model';

/**
 * Owns the active locale for the whole application.
 *
 * The locale lives in the URL (`/en/...`, `/fr/...`) — it is never stored only
 * in memory, so every page is independently shareable, crawlable and
 * server-renderable in the right language.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<Locale>(DEFAULT_LOCALE);

  readonly locale = this.current.asReadonly();
  readonly locales = LOCALES;

  /** The locale a language switcher should offer. */
  readonly alternate = computed<Locale>(() => (this.current() === 'en' ? 'fr' : 'en'));

  /** BCP-47 tag for `<html lang>`, `Intl` and structured data. */
  readonly htmlLang = computed(() => (this.current() === 'fr' ? 'fr-TN' : 'en'));

  constructor() {
    // Keep Transloco and the document element in step with the signal. This is
    // the only place either is written.
    effect(() => {
      const locale = this.current();
      this.transloco.setActiveLang(locale);
      this.document.documentElement.lang = locale === 'fr' ? 'fr-TN' : 'en';
    });
  }

  set(locale: Locale): void {
    if (this.current() !== locale) {
      this.current.set(locale);
    }
  }

  /** Resolves a catalogue string against the active locale. */
  text(value: LocalizedText): string {
    return resolveLocalized(value, this.current());
  }

  /**
   * Chooses a locale for a bare `/` request from an Accept-Language header.
   * French is the default: it is the language the business actually operates in
   * and the only language the legacy site ever served.
   */
  static negotiate(acceptLanguage: string | null | undefined): Locale {
    if (!acceptLanguage) {
      return DEFAULT_LOCALE;
    }
    const ranked = acceptLanguage
      .split(',')
      .map((part) => {
        const [tag = '', ...params] = part.trim().split(';');
        const qParam = params.find((p) => p.trim().startsWith('q='));
        const q = qParam ? Number.parseFloat(qParam.split('=')[1] ?? '1') : 1;
        return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
      })
      .sort((a, b) => b.q - a.q);

    for (const { tag } of ranked) {
      const base = tag.split('-')[0] ?? '';
      if (isLocale(base)) {
        return base;
      }
    }
    return DEFAULT_LOCALE;
  }
}
