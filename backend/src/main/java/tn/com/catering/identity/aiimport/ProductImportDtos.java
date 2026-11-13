package tn.com.catering.identity.aiimport;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import tn.com.catering.identity.entities.SaleMode;

/** Wire types of the AI import endpoints. */
public final class ProductImportDtos {

    private ProductImportDtos() {}

    public record ItemResponse(
            UUID id,
            String status,
            String action,
            String originalFilename,
            String imageUrl,
            String displayUrl,
            Integer imageWidth,
            Integer imageHeight,
            String nameFr,
            String nameEn,
            String shortDescriptionFr,
            String shortDescriptionEn,
            String descriptionFr,
            String descriptionEn,
            String categoryId,
            String subcategoryId,
            String brandId,
            List<String> industries,
            String formatValue,
            Integer packQuantity,
            String unitLabel,
            UUID matchedProductId,
            String matchedProductName,
            Double matchScore,
            UUID publishedProductId,
            String model,
            String error,
            String warning,
            String priceSource,
            String priceNote,
            String suggestedSaleMode,
            BigDecimal suggestedPrice,
            int attempts,
            Instant createdAt) {

        static ItemResponse of(ProductImportItem item) {
            return new ItemResponse(
                    item.getId(), item.getStatus().name(),
                    item.getAction() == null ? null : item.getAction().name(),
                    item.getOriginalFilename(), item.getImageUrl(), item.getDisplayUrl(),
                    item.getImageWidth(), item.getImageHeight(),
                    item.getNameFr(), item.getNameEn(),
                    item.getShortDescriptionFr(), item.getShortDescriptionEn(),
                    item.getDescriptionFr(), item.getDescriptionEn(),
                    item.getCategoryId(), item.getSubcategoryId(), item.getBrandId(),
                    item.getIndustries() == null || item.getIndustries().isBlank()
                            ? List.of()
                            : Arrays.asList(item.getIndustries().split(",")),
                    item.getFormatValue(), item.getPackQuantity(), item.getUnitLabel(),
                    item.getMatchedProductId(), item.getMatchedProductName(), item.getMatchScore(),
                    item.getPublishedProductId(), item.getModel(), item.getError(), item.getWarning(),
                    item.getPriceSource(), item.getPriceNote(), item.getSuggestedSaleMode(), item.getSuggestedPrice(),
                    item.getAttempts(), item.getCreatedAt());
        }
    }

    public record ListResponse(
            boolean configured,
            String model,
            Map<String, Long> counts,
            List<ItemResponse> items) {}

    /** One loaded price list. */
    public record PriceListResponse(String listName, String sourceFile, long rows, Instant uploadedAt) {}

    /** The administrator's corrections to a proposal, before publishing. */
    public record UpdateRequest(
            @NotNull ProductImportItem.Action action,
            UUID matchedProductId,
            @NotBlank @Size(max = 255) String nameFr,
            @Size(max = 255) String nameEn,
            @Size(max = 1000) String shortDescriptionFr,
            @Size(max = 1000) String shortDescriptionEn,
            @Size(max = 4000) String descriptionFr,
            @Size(max = 4000) String descriptionEn,
            @NotBlank @Size(max = 80) String categoryId,
            @Size(max = 80) String subcategoryId,
            @Size(max = 80) String brandId,
            List<String> industries,
            @Size(max = 160) String formatValue,
            @Min(1) @Max(100000) Integer packQuantity,
            @Pattern(regexp = "piece|gobelet|barquette|sachet|boite|rouleau|bouteille|paire|feuille|bol|pot|paille|pique|sac|can")
            String unitLabel) {}

    /**
     * The price, typed by the administrator. It is the one thing the model never
     * proposes. A UNIT product needs {@code price}; a PACK_ONLY product needs
     * {@code unitPrice} and a pack quantity, and its pack price is derived.
     */
    public record PublishRequest(
            SaleMode saleMode,
            @DecimalMin("0.001") @Digits(integer = 7, fraction = 3) BigDecimal price,
            @DecimalMin("0.001") @Digits(integer = 7, fraction = 3) BigDecimal unitPrice) {}
}
