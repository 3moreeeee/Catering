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
        Instant updatedAt) {}
