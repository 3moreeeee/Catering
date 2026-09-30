import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/load-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The bundled catalogue exactly as the application renders it: the Vinto feeds
 * after the supplier price-list reconciliation. Reading the raw feed tuples
 * instead would measure withdrawn products and miss the added ones.
 */
export async function supplierProducts() {
  const { PRODUCTS } = await loadCatalog(ROOT);
  return PRODUCTS;
}
