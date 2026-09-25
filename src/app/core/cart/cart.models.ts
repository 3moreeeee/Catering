import { LocalizedText } from '../../shared/models/localized-text.model';

/**
 * Wire types for the panier and devis API.
 *
 * Money is typed as `number | null` rather than `number`: the company has not
 * priced every reference, and a null price means "prix sur demande". It is never
 * coerced to 0, which would read as free.
 */
export interface CartItem {
  readonly id: string;
  readonly productId: string;
  readonly productSlug: string;
  readonly productName: LocalizedText;
  readonly images: readonly { src: string; alt: LocalizedText; width: number; height: number }[];
  readonly reference: string | null;
  readonly formatValue: string | null;
  readonly quantity: number;
  readonly unitPrice: number | null;
  readonly lineTotal: number | null;
  readonly currency: string | null;
}

export interface Cart {
  readonly id: string;
  readonly status: 'OPEN' | 'CONVERTED' | 'ABANDONED';
  readonly items: readonly CartItem[];
  readonly itemCount: number;
  readonly totalQuantity: number;
  /** Sum of the priced lines only. Partial when `hasUnpricedItems` is true. */
  readonly total: number;
  readonly currency: string;
  readonly hasUnpricedItems: boolean;
  readonly updatedAt: string;
}

export type QuoteStatus = 'SUBMITTED' | 'IN_REVIEW' | 'ANSWERED' | 'CLOSED';

/** A direct order at the displayed prices, or a request for a negotiated offer. */
export type QuoteKind = 'ORDER' | 'QUOTE';

export interface QuoteLine {
  readonly id: string;
  readonly productId: string | null;
  readonly productSourceId: string;
  readonly productName: string;
  readonly reference: string | null;
  readonly formatValue: string | null;
  readonly quantity: number;
  readonly unitPrice: number | null;
  readonly lineTotal: number | null;
}

export interface Quote {
  readonly id: string;
  readonly reference: string;
  readonly status: QuoteStatus;
  readonly kind: QuoteKind;
  readonly contactEmail: string;
  readonly contactName: string | null;
  readonly companyName: string | null;
  readonly contactPhone: string | null;
  readonly deliveryCity: string | null;
  readonly message: string | null;
  readonly adminNote: string | null;
  readonly totalAmount: number | null;
  readonly currency: string | null;
  readonly hasUnpricedLines: boolean;
  readonly lines: readonly QuoteLine[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuoteSubmitPayload {
  readonly contactName?: string;
  readonly companyName?: string;
  readonly contactPhone?: string;
  readonly deliveryCity?: string;
  readonly message?: string;
  readonly kind?: QuoteKind;
}

/**
 * The catalogue bridge record.
 *
 * The storefront still browses the bundled catalogue snapshot (which is what
 * serves faceting and prerendering), so it looks prices and backend ids up by
 * `sourceId`, the key both sides share.
 */
export interface ProductPricePoint {
  readonly sourceId: string;
  readonly id: string;
  readonly slug: string;
  readonly price: number | null;
  readonly originalPrice: number | null;
  readonly offerActive: boolean;
  readonly currency: string | null;
  readonly stockQuantity: number | null;
  readonly active: boolean;
}
