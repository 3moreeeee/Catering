package tn.com.catering.identity.DTO;

import java.math.BigDecimal;
import java.util.UUID;

public record QuoteLineResponse(
        UUID id,
        UUID productId,
        String productSourceId,
        String productName,
        String reference,
        String formatValue,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal,
        /** Frozen pack terms; null for a unit line. quantity then counts packs. */
        String saleMode,
        Integer packQuantity,
        BigDecimal piecePrice,
        String unitLabel,
        Long totalPieces) {}
