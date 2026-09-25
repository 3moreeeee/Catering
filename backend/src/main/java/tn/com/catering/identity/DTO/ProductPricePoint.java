package tn.com.catering.identity.DTO;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * The minimum a storefront needs to price a product and put it in a panier.
 *
 * <p>It exists so the Angular catalogue, which still browses and facets the
 * bundled snapshot, can look up live prices and the backend UUID for the rows it
 * is about to render, without the whole catalogue having to move behind the API
 * first. Keyed by sourceId, the id both sides already share.
 */
public record ProductPricePoint(
        String sourceId,
        UUID id,
        String slug,
        BigDecimal price,
        BigDecimal originalPrice,
        boolean offerActive,
        String currency,
        Integer stockQuantity,
        boolean active) {}
