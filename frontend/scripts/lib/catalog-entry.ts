// Entry point for the audit scripts' catalogue bundle. See load-catalog.mjs.
//
// This exists so the reconciliation tooling reads the same records the
// application renders, rather than a copy that would drift.

// CURATED_PRODUCTS is the reconciliation baseline: comparing against the
// combined PRODUCTS would make the import read its own previous output as an
// existing catalogue and delete itself on the second run.
export { PRODUCTS, CURATED_PRODUCTS } from '../../src/app/data/products.data';
export { IMPORTED_PRODUCTS } from '../../src/app/data/products.imported.data';
export { MONIN_PRODUCTS } from '../../src/app/data/products.monin.data';
export {
  CATALOG_ADDITIONS,
  CATALOG_CORRECTIONS,
  CATALOG_RECONCILIATION_BATCH,
  CATALOG_REMOVALS,
} from '../../src/app/data/catalog-reconciliation.data';
export { groupColorVariants } from '../../src/app/data/product-color-variants';
export { BRANDS } from '../../src/app/data/brands.data';
export { CATEGORIES } from '../../src/app/data/categories.data';
export { INDUSTRIES } from '../../src/app/data/industries.data';
export { SALE_TERMS } from '../../src/app/data/products.data';
export {
  PRODUCT_SUPPLIER_LINES,
  SUPPLIER_LINES,
  UNPRICED_BY_SUPPLIER,
} from '../../src/app/data/supplier-price-lists.data';
export { CATALOG_IMAGES, CATALOG_IMAGE_REJECTIONS } from '../../src/app/data/catalog-images.data';
