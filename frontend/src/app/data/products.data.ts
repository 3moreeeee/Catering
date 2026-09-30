import { Product } from '../shared/models/catalog.model';
import { IMPORTED_PRODUCTS } from './products.imported.data';
import { MONIN_PRODUCTS } from './products.monin.data';
import { groupColorVariants } from './product-color-variants';
import { applyCatalogReconciliation, catalogSaleTerms } from './catalog-reconciliation.data';

/**
 * The former hand-authored catalogue was intentionally removed. The Vinto
 * feeds supply records and photographs; the company's supplier price lists
 * then decide which of them are sold and under which identity (see
 * catalog-reconciliation.data.ts).
 */
export const CURATED_PRODUCTS: readonly Product[] = [];

const FEED: readonly Product[] = [...IMPORTED_PRODUCTS, ...MONIN_PRODUCTS].filter(
  (product) => !JSON.stringify(product).toLowerCase().includes('delicio'),
);

/** Supplier sale terms (price, lot, unit) per product id; read by the seed exporter. */
export const SALE_TERMS = catalogSaleTerms(FEED);

export const PRODUCTS: readonly Product[] = applyCatalogReconciliation(FEED, SALE_TERMS);

/** Buyer-facing catalogue: supplier color SKUs stay in PRODUCTS for ordering and old URLs. */
export const DISPLAY_PRODUCTS: readonly Product[] = groupColorVariants(PRODUCTS);
