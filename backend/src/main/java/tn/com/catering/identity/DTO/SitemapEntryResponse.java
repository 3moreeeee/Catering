package tn.com.catering.identity.DTO;

import java.time.Instant;

/** One public product URL for the sitemap. */
public record SitemapEntryResponse(String slug, String categoryId, Instant updatedAt) {}
