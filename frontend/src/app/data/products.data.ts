import { Product } from '../shared/models/catalog.model';
import { IMPORTED_PRODUCTS } from './products.imported.data';
import { MONIN_PRODUCTS } from './products.monin.data';

/**
 * The former hand-authored catalogue was intentionally removed. Vinto is now
 * the single source of truth for Food, Packaging and Hygiene; MONIN keeps its
 * dedicated synchronised feed.
 */
export const CURATED_PRODUCTS: readonly Product[] = [];

export const PRODUCTS: readonly Product[] = [...IMPORTED_PRODUCTS, ...MONIN_PRODUCTS].filter(
  (product) => !JSON.stringify(product).toLowerCase().includes('delicio'),
);
