import { describe, expect, it } from 'vitest';
import { LocaleService } from './locale.service';
import { resolveLocalized, isLocale } from '../../shared/models/localized-text.model';
import { COMPANY, PRESIDENT_MESSAGE, COMPANY_VALUES } from '../../data/company.data';
import { BRANDS } from '../../data/brands.data';
import { INDUSTRIES } from '../../data/industries.data';

describe('locale negotiation', () => {
  it('honours the highest-weighted supported language', () => {
    expect(LocaleService.negotiate('en-GB,en;q=0.9,fr;q=0.8')).toBe('en');
    expect(LocaleService.negotiate('fr-TN,fr;q=0.9,en;q=0.5')).toBe('fr');
  });

  it('respects q-values rather than document order', () => {
    expect(LocaleService.negotiate('de;q=1.0,en;q=0.4,fr;q=0.9')).toBe('fr');
  });

  it('falls back to French — the language the business actually operates in', () => {
    expect(LocaleService.negotiate(null)).toBe('fr');
    expect(LocaleService.negotiate('')).toBe('fr');
    expect(LocaleService.negotiate('de-DE,it;q=0.8')).toBe('fr');
  });

  it('matches on the base tag, so fr-CA still resolves to fr', () => {
    expect(LocaleService.negotiate('fr-CA')).toBe('fr');
  });
});

describe('localized text', () => {
  it('resolves the requested locale', () => {
    expect(resolveLocalized({ en: 'Gloves', fr: 'Gants' }, 'en')).toBe('Gloves');
    expect(resolveLocalized({ en: 'Gloves', fr: 'Gants' }, 'fr')).toBe('Gants');
  });

  it('falls back to the other locale rather than rendering an empty string', () => {
    expect(resolveLocalized({ en: '', fr: 'Gants' }, 'en')).toBe('Gants');
  });

  it('validates locale codes', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('company data integrity', () => {
  it('preserves the verified contact details from the legacy site', () => {
    expect(COMPANY.telephone).toBe('+21671557548');
    expect(COMPANY.fax).toBe('+21671557475');
    expect(COMPANY.email).toBe('contact@catering.com.tn');
    expect(COMPANY.address.street).toBe("Zone Industrielle M'nihla");
    expect(COMPANY.address.postalCode).toBe('2094');
    expect(COMPANY.foundedYear).toBe(1985);
  });

  it('leaves unpublished fields explicitly null rather than inventing them', () => {
    // Business hours and coordinates were never published. A plausible guess
    // here would put wrong information on a supplier's contact page.
    expect(COMPANY.businessHours).toBeNull();
    expect(COMPANY.geo).toBeNull();
  });

  it('drops the legacy dead social links', () => {
    const urls = COMPANY.social.map((s) => s.url).join(' ');
    expect(urls).not.toContain('plus.google.com');
    expect(urls).not.toMatch(/^https?:\/\/(www\.)?twitter\.com\/?$/);
    expect(urls).not.toContain('rss.com');
  });

  it('keeps the founder message in both locales, paragraph for paragraph', () => {
    expect(PRESIDENT_MESSAGE.length).toBe(6);
    for (const paragraph of PRESIDENT_MESSAGE) {
      expect(paragraph.fr.length).toBeGreaterThan(20);
      expect(paragraph.en.length).toBeGreaterThan(20);
    }
  });

  it('states no numeric statistic in the values copy', () => {
    // The brief forbids invented figures. Values are qualitative claims only,
    // each traceable to a sentence in the founder's message.
    for (const value of COMPANY_VALUES) {
      const text = `${value.title.en} ${value.body.en}`;
      const numbers = text.match(/\b\d{2,}\b/g) ?? [];
      // 1985 is the single documented figure and is allowed.
      expect(numbers.every((n) => n === '1985')).toBe(true);
    }
  });
});

describe('brand data integrity', () => {
  it('lists the complete brand portfolio published by Vinto', () => {
    expect(BRANDS.map((b) => b.id)).toEqual([
      'caterware',
      'dijona',
      'emporium',
      'martellato',
      'mayor',
      'monin',
      'varvello',
    ]);
  });

  it('stores every official brand logo locally', () => {
    expect(BRANDS.every((brand) => brand.logo.startsWith('/img/brands/'))).toBe(true);
    expect(BRANDS.every((brand) => brand.logo.endsWith('.png'))).toBe(true);
  });
});

describe('industry data integrity', () => {
  it('marks exactly the sectors the founder named as source-verified', () => {
    const verified = INDUSTRIES.filter((i) => i.sourceVerified).map((i) => i.id).sort();
    expect(verified).toEqual(['healthcare', 'pharmaceutical', 'restaurants', 'retail']);
  });

  it('marks brief-derived sectors as unverified', () => {
    const unverified = INDUSTRIES.filter((i) => !i.sourceVerified).map((i) => i.id).sort();
    expect(unverified).toEqual(['food-production', 'hotels']);
  });
});
