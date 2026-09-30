package tn.com.catering.identity.DTO;

import java.util.Map;

/** Catalogue sizes for the storefront's counters: total, per division and per brand. */
public record CatalogStatsResponse(long total, Map<String, Long> categories, Map<String, Long> brands) {}
