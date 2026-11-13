package tn.com.catering.identity.DTO;

import java.util.Map;

/**
 * Catalogue sizes for the storefront's counters: total, per division, per
 * category or sub-category id a product is filed under (the menu hides the
 * empty ones), and per brand.
 */
public record CatalogStatsResponse(long total, Map<String, Long> categories,
                                   Map<String, Long> subcategories, Map<String, Long> brands) {}
