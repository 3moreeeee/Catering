/**
 * Read-only server knowledge facade for the website assistant.
 *
 * Keeping source imports inside the data layer preserves the repository
 * boundary. A future CMS can replace this facade without coupling the API
 * handler to individual bundled data files.
 */
export { BRANDS } from './brands.data';
export { CATEGORIES } from './categories.data';
export { COMPANY, COMPANY_VALUES, PRESIDENT_MESSAGE, PUBLISHED_MILESTONES } from './company.data';
export { INDUSTRIES } from './industries.data';
export { PRODUCTS } from './products.data';
