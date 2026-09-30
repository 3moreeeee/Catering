package tn.com.catering.identity.DTO;

/**
 * Measured bounds of the product object within its photograph, used by the
 * storefront to scale photographs of different formats consistently. Present
 * only for catalogue photographs that have been measured.
 */
public record ImageMetricsResponse(double occupancy, double width, double bottom, boolean reliable) {}
