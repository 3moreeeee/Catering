package tn.com.catering.identity.DTO;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CartItemResponse(
        UUID id,
        UUID productId,
        String productSlug,
        LocalizedText productName,
        List<ProductImageResponse> images,
        String reference,
        String formatValue,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal,
        String currency) {}
