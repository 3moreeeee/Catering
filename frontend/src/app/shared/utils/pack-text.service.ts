import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { formatMillimes, packMillimes, toMillimes } from './money';

export type SaleMode = 'UNIT' | 'PACK_ONLY';

/** Sale-unit codes the backend accepts; each has a singular and a plural in both locales. */
export const UNIT_LABELS = [
  'piece',
  'gobelet',
  'barquette',
  'sachet',
  'boite',
  'rouleau',
  'bouteille',
  'paire',
  'feuille',
  'bol',
  'pot',
  'paille',
  'pique',
  'sac',
  'can',
] as const;

/** The pack terms of a PACK_ONLY product: price of one piece, pieces per pack, what a piece is. */
export interface PackTerms {
  readonly unitPrice: number;
  readonly packQuantity: number;
  readonly unitLabel: string;
}

interface PackSource {
  readonly saleMode?: string | null;
  readonly unitPrice?: number | null;
  readonly packQuantity?: number | null;
  readonly unitLabel?: string | null;
}

/**
 * The pack terms of anything the API returns (price point, admin product), or
 * null when it is not sold by the pack. A UNIT product with a descriptive pack
 * size ("LES 250 PIÈCES") is deliberately not a pack product here: its price is
 * already the price of the lot and must not be multiplied again.
 */
export function packTermsOf(source: PackSource | null | undefined): PackTerms | null {
  if (!source || source.saleMode !== 'PACK_ONLY') return null;
  if (source.unitPrice == null || !source.packQuantity) return null;
  return {
    unitPrice: source.unitPrice,
    packQuantity: source.packQuantity,
    unitLabel: source.unitLabel ?? 'piece',
  };
}

/** Localised wording for pack sales, shared by the storefront, the panier and the back office. */
@Injectable({ providedIn: 'root' })
export class PackText {
  private readonly transloco = inject(TranslocoService);

  private get lang(): string {
    return this.transloco.getActiveLang();
  }

  /** "12,000 TND": the amount and its currency only, always three decimals. */
  money(amount: number, currency = 'TND'): string {
    return this.moneyMillimes(toMillimes(amount), currency);
  }

  moneyMillimes(millimes: number, currency = 'TND'): string {
    return formatMillimes(millimes, this.lang, currency);
  }

  /** A price, or "Prix sur demande" when the company publishes none. */
  price(amount: number | null | undefined, currency: string | null = 'TND'): string {
    return amount == null
      ? this.transloco.translate('cart.priceOnRequest')
      : this.money(amount, currency ?? 'TND');
  }

  /** "pièce" / "pièces", "piece" / "pieces". */
  unit(code: string, count: number): string {
    const known = (UNIT_LABELS as readonly string[]).includes(code) ? code : 'piece';
    return this.transloco.translate(`units.${known}.${count === 1 ? 'one' : 'other'}`);
  }

  /** "0,120 TND / pièce" */
  perUnit(terms: PackTerms): string {
    return `${this.money(terms.unitPrice)} / ${this.unit(terms.unitLabel, 1)}`;
  }

  /** "100 pièces" */
  pieces(count: number, unitLabel: string): string {
    return `${count} ${this.unit(unitLabel, count)}`;
  }

  /** "Vendu par lot de 100 pièces" */
  soldBy(terms: PackTerms): string {
    return this.transloco.translate('pack.soldBy', {
      pieces: this.pieces(terms.packQuantity, terms.unitLabel),
    });
  }

  /** "12,000 TND / lot" */
  perPack(amount: number): string {
    return `${this.money(amount)} / ${this.transloco.translate('pack.packs.one')}`;
  }

  /** "1 lot", "2 lots" */
  packs(count: number): string {
    return `${count} ${this.transloco.translate(`pack.packs.${count === 1 ? 'one' : 'other'}`)}`;
  }

  /** "2 lots = 200 pièces" */
  packsEqual(count: number, terms: PackTerms): string {
    return `${this.packs(count)} = ${this.pieces(count * terms.packQuantity, terms.unitLabel)}`;
  }

  /** "0,120 TND × 100" */
  calculation(terms: PackTerms): string {
    return `${formatMillimes(toMillimes(terms.unitPrice), this.lang)} × ${terms.packQuantity}`;
  }

  /** Pack price, exact, from the two factors. */
  packPrice(terms: PackTerms): string {
    return this.moneyMillimes(packMillimes(terms.unitPrice, terms.packQuantity));
  }
}
