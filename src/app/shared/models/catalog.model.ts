import { LocalizedText } from './localized-text.model';

/**
 * First-level commercial universes. Fixed by the business, not by the CMS —
 * so this remains a union rather than an arbitrary string.
 */
export const CATEGORY_IDS = ['food', 'monin', 'packaging', 'hygiene'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const INDUSTRY_IDS = [
  'restaurants',
  'hotels',
  'retail',
  'food-production',
  'healthcare',
  'pharmaceutical',
] as const;
export type IndustryId = (typeof INDUSTRY_IDS)[number];

// -----------------------------------------------------------------------------
// SEO
// -----------------------------------------------------------------------------

export interface SeoMetadata {
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  /** Path to the social share image, relative to /public. */
  readonly ogImage?: string;
}

// -----------------------------------------------------------------------------
// Product
// -----------------------------------------------------------------------------

export interface ProductImage {
  readonly src: string;
  /** Meaningful alt text. Never empty for a product image, never "Hello World". */
  readonly alt: LocalizedText;
  readonly width: number;
  readonly height: number;
}

export interface ProductOffer {
  readonly price: number;
  readonly originalPrice: number;
  readonly currency: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly currentlyActive: boolean;
}

/**
 * A purchasable format (pack size, volume, dimension).
 *
 * `value` is a display string rather than a number+unit pair because the source
 * data expresses formats inconsistently ("946 ml", "6.7 & 8", "30x30 2 plis").
 * Normalising it would mean inventing precision the company has not supplied.
 */
export interface ProductFormat {
  readonly id: string;
  readonly value: string;
  /** Units contained in a trade pack, when the supplier publishes it. */
  readonly packQuantity?: number;
  /** Machine-readable size bucket, used by the packaging-size facet. */
  readonly sizeBucket?: SizeBucket;
  readonly reference?: string;
}

export const SIZE_BUCKETS = ['single', 'small', 'medium', 'large', 'bulk'] as const;
export type SizeBucket = (typeof SIZE_BUCKETS)[number];

export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly shortDescription: LocalizedText;
  readonly description: LocalizedText;
  readonly categoryId: CategoryId;
  readonly subcategoryId?: string;
  readonly brandId?: string;
  readonly industries: readonly IndustryId[];
  readonly formats: readonly ProductFormat[];
  readonly images: readonly ProductImage[];
  readonly featured: boolean;
  /** Configured promotion returned by Neon, including upcoming offers. */
  readonly offer?: ProductOffer;
  /**
   * Placeholder until the company supplies PDFs. When absent, the download
   * affordance renders disabled with an explanatory note rather than a dead link.
   */
  readonly technicalSheetUrl?: string;
  /** Optional GLTF for the product turntable. Almost always absent. */
  readonly modelUrl?: string;
  readonly seo: SeoMetadata;
  /**
   * True when any field on this product was inferred rather than read from a
   * company source. Surfaces a "pending verification" note in the UI and is
   * listed in the migration checklist.
   */
  readonly needsVerification?: boolean;
}

// -----------------------------------------------------------------------------
// Category / Subcategory
// -----------------------------------------------------------------------------

export interface Subcategory {
  readonly id: string;
  readonly slug: string;
  readonly categoryId: CategoryId;
  readonly name: LocalizedText;
}

export interface Category {
  readonly id: CategoryId;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly shortName: LocalizedText;
  readonly description: LocalizedText;
  readonly longDescription: LocalizedText;
  readonly image: string;
  readonly icon: string;
  /** Hex accent for this division. Mirrors --c-cat-* in the token file. */
  readonly accent: string;
  readonly subcategories: readonly Subcategory[];
  readonly seo: SeoMetadata;
}

// -----------------------------------------------------------------------------
// Brand
// -----------------------------------------------------------------------------

export interface Brand {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly logo: string;
  readonly description: LocalizedText;
  readonly categoryIds: readonly CategoryId[];
  /** Only populated where the origin is verifiable. */
  readonly country?: LocalizedText;
  readonly website?: string;
  readonly needsVerification?: boolean;
}

// -----------------------------------------------------------------------------
// Industry
// -----------------------------------------------------------------------------

export interface Industry {
  readonly id: IndustryId;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly howWeSupport: LocalizedText;
  readonly icon: string;
  readonly relevantCategories: readonly CategoryId[];
  /**
   * True when the sector is named verbatim in the founder's message on the
   * original site. False means it comes from the brief and needs confirmation.
   */
  readonly sourceVerified: boolean;
  readonly seo: SeoMetadata;
}

// -----------------------------------------------------------------------------
// Query / filtering
// -----------------------------------------------------------------------------

export const SORT_OPTIONS = ['relevance', 'name-asc', 'name-desc', 'category'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const VIEW_MODES = ['grid', 'list'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export interface ProductQuery {
  readonly q?: string;
  readonly categories?: readonly CategoryId[];
  readonly subcategories?: readonly string[];
  readonly brands?: readonly string[];
  readonly industries?: readonly IndustryId[];
  readonly sizes?: readonly SizeBucket[];
  readonly sort?: SortOption;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface FacetValue {
  readonly id: string;
  readonly label: LocalizedText;
  readonly count: number;
}

export interface FacetSet {
  readonly categories: readonly FacetValue[];
  readonly subcategories: readonly FacetValue[];
  readonly brands: readonly FacetValue[];
  readonly industries: readonly FacetValue[];
  readonly sizes: readonly FacetValue[];
}
