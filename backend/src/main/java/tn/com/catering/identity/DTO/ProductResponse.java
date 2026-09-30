package tn.com.catering.identity.DTO;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The catalogue read model.
 *
 * <p>Bilingual fields are returned as {@link LocalizedText} pairs so the Angular
 * client can keep using the shape its models already declare, rather than the
 * API picking a language and forcing a round trip on language switch.
 *
 * <p>{@code price} is null - not zero - when the company has published none, and
 * the client renders "prix sur demande" for that case.
 */
public record ProductResponse(
        UUID id,
        String sourceId,
        String slug,
        LocalizedText name,
        LocalizedText shortDescription,
        LocalizedText description,
        String categoryId,
        String subcategoryId,
        String brandId,
        List<String> industries,
        BigDecimal price,
        String currency,
        BigDecimal offerPrice,
        Instant offerStartsAt,
        Instant offerEndsAt,
        boolean offerActive,
        boolean offerCurrentlyActive,
        Integer stockQuantity,
        String reference,
        String technicalSheetUrl,
        boolean featured,
        boolean active,
        boolean needsVerification,
        LocalizedText seoTitle,
        LocalizedText seoDescription,
        List<ProductImageResponse> images,
        List<ProductFormatResponse> formats,
        Instant createdAt,
        Instant updatedAt,
        /** UNIT or PACK_ONLY; always present, UNIT for records that predate pack pricing. */
        String saleMode,
        /** Price of one piece; null unless PACK_ONLY. */
        BigDecimal unitPrice,
        /** Pieces per commercial pack, from the primary format; null when unpublished. */
        Integer packQuantity,
        String unitLabel,
        /** unitPrice × packQuantity, computed on the server; null unless PACK_ONLY. Equal to {@code price}. */
        BigDecimal packPrice,
        /** The colours of a supplier line shown once in the catalogue; empty for every other product. */
        List<ColorVariantResponse> colorVariants) {}
