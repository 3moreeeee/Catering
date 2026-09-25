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
        BigDecimal lineTotal) {}
