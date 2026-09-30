/**
 * Tunisian dinar arithmetic in integer millimes.
 *
 * The dinar has three decimals, and a JavaScript number cannot hold 0.120 or
 * 0.333 exactly: 0.333 × 100 is 33.300000000000004. Every amount computed in
 * the browser therefore goes through whole millimes, where multiplication by a
 * pack size or a quantity is exact. The server stays authoritative; this only
 * keeps previews and displays truthful.
 */

/** An amount the API returned (already millime-exact) as whole millimes. */
export function toMillimes(amount: number): number {
  return Math.round(amount * 1000);
}

/**
 * Parses what an administrator typed ("0,120", "12.5", "7") into millimes,
 * reading the digits as text so no binary fraction is ever involved. Null when
 * the text is not a non-negative amount with at most three decimals.
 */
export function parseMillimes(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,7})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;
  return Number(match[1]) * 1000 + Number((match[2] ?? '').padEnd(3, '0'));
}

/** "12,000 TND" in French, "12.000 TND" in English: always three decimals. */
export function formatMillimes(millimes: number, lang: string, currency = 'TND'): string {
  const sign = millimes < 0 ? '-' : '';
  const absolute = Math.abs(millimes);
  const dinars = Math.trunc(absolute / 1000);
  const fraction = String(absolute % 1000).padStart(3, '0');
  return `${sign}${dinars}${lang === 'fr' ? ',' : '.'}${fraction} ${currency}`;
}

export function formatTnd(amount: number, lang: string, currency = 'TND'): string {
  return formatMillimes(toMillimes(amount), lang, currency);
}

/** Price of a pack, in millimes: unit price × pieces, exact. */
export function packMillimes(unitPrice: number, packQuantity: number): number {
  return toMillimes(unitPrice) * packQuantity;
}
