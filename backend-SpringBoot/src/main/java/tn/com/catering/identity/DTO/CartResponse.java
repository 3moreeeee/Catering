package tn.com.catering.identity.DTO;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The panier as the storefront shows it.
 *
 * <p>{@code hasUnpricedItems} exists so the UI can label the total as partial
 * instead of implying that unpriced references are free. {@code total} sums only
 * the lines that carry a price.
 */
public record CartResponse(
        UUID id,
        String status,
        List<CartItemResponse> items,
        int itemCount,
        int totalQuantity,
        BigDecimal total,
        String currency,
        boolean hasUnpricedItems,
        Instant updatedAt) {}
