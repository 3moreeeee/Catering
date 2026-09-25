// Entry point for the audit scripts' catalogue bundle. See load-catalog.mjs.
//
// This exists so the reconciliation tooling reads the same records the
// application renders, rather than a copy that would drift.

// CURATED_PRODUCTS is the reconciliation baseline: comparing against the
// combined PRODUCTS would make the import read its own previous output as an
// existing catalogue and delete itself on the second run.
export { PRODUCTS, CURATED_PRODUCTS } from '../../src/app/data/products.data';
export { BRANDS } from '../../src/app/data/brands.data';
export { CATEGORIES } from '../../src/app/data/categories.data';
export { INDUSTRIES } from '../../src/app/data/industries.data';
