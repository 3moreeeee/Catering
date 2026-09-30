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
        String currency,
        /*
         * Pack fields. For a PACK_ONLY product {@code quantity} counts packs and
         * {@code unitPrice} is the price of one pack; these say what a pack is.
         * They are null for a UNIT product.
         */
        String saleMode,
        Integer packQuantity,
        /** Price of one piece. */
        BigDecimal piecePrice,
        String unitLabel,
        /** quantity × packQuantity. */
        Long totalPieces) {}
