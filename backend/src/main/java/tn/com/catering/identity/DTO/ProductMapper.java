package tn.com.catering.identity.DTO;

import java.util.List;
import org.springframework.stereotype.Component;
import tn.com.catering.identity.entities.Brand;
import tn.com.catering.identity.entities.Category;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.entities.ProductFormat;
import tn.com.catering.identity.entities.ProductImage;
import tn.com.catering.identity.services.ProductImageMetrics;

/**
 * Hand-written mapping, deliberately: the entity/DTO shapes differ enough
 * (bilingual pairs, nested subcategories) that a generated mapper would need as
 * much configuration as this is code.
 */
@Component
public class ProductMapper {

    private final ProductImageMetrics imageMetrics;

    public ProductMapper(ProductImageMetrics imageMetrics) {
        this.imageMetrics = imageMetrics;
    }

    public ProductResponse toResponse(Product product) {
        return toResponse(product, null);
    }

    /**
     * @param group the colour line this product represents in the catalogue, or
     *              null; the line's single designation then replaces the SKU's name.
     */
    public ProductResponse toResponse(Product product, ColorGroupView group) {
        LocalizedText name = group == null
                ? LocalizedText.of(product.getNameFr(), product.getNameEn())
                : group.name();
        LocalizedText seoTitle = group == null
                ? LocalizedText.of(product.getSeoTitleFr(), product.getSeoTitleEn())
                : group.name();
        return new ProductResponse(
                product.getId(),
                product.getSourceId(),
                product.getSlug(),
                name,
                LocalizedText.of(product.getShortDescriptionFr(), product.getShortDescriptionEn()),
                LocalizedText.of(product.getDescriptionFr(), product.getDescriptionEn()),
                product.getCategoryId(),
                product.getSubcategoryId(),
                product.getBrandId(),
                List.copyOf(product.getIndustries()),
                product.getPrice(),
                product.getCurrency(),
                product.getOfferPrice(),
                product.getOfferStartsAt(),
                product.getOfferEndsAt(),
                product.isOfferActive(),
                product.hasCurrentOffer(),
                product.getStockQuantity(),
                product.getSupplierReference(),
                product.getTechnicalSheetUrl(),
                product.isFeatured(),
                product.isActive(),
                product.isNeedsVerification(),
                seoTitle,
                LocalizedText.of(product.getSeoDescriptionFr(), product.getSeoDescriptionEn()),
                product.getImages().stream().map(this::toResponse).toList(),
                product.getFormats().stream().map(this::toResponse).toList(),
                product.getCreatedAt(),
                product.getUpdatedAt(),
                product.getSaleMode().name(),
                product.isPackOnly() ? product.getUnitPrice() : null,
                product.getPackQuantity(),
                product.getUnitLabel(),
                product.isPackOnly() ? product.packPrice() : null,
                group == null ? List.of() : group.variants());
    }

    /** A colour line's presentation: its supplier designation and its colours. */
    public record ColorGroupView(LocalizedText name, List<ColorVariantResponse> variants) {}

    public ProductImageResponse toResponse(ProductImage image) {
        return new ProductImageResponse(
                image.getSrc(),
                LocalizedText.of(image.getAltFr(), image.getAltEn()),
                image.getWidth(),
                image.getHeight(),
                imageMetrics.of(image.getSrc()));
    }

    public ProductFormatResponse toResponse(ProductFormat format) {
        return new ProductFormatResponse(
                format.getExternalId(),
                format.getFormatValue(),
                format.getPackQuantity(),
                format.getSizeBucket(),
                format.getFormatReference());
    }

    public BrandResponse toResponse(Brand brand) {
        return new BrandResponse(
                brand.getId(),
                brand.getExternalId(),
                brand.getSlug(),
                brand.getName(),
                brand.getLogo(),
                LocalizedText.of(brand.getDescriptionFr(), brand.getDescriptionEn()),
                brand.getWebsite());
    }

    /** Subcategories are supplied by the caller, which already has them grouped. */
    public CategoryResponse toResponse(Category category, List<CategoryResponse> subcategories) {
        return new CategoryResponse(
                category.getId(),
                category.getExternalId(),
                category.getSlug(),
                LocalizedText.of(category.getNameFr(), category.getNameEn()),
                category.getAccent(),
                category.getImage(),
                category.getIcon(),
                subcategories);
    }
}
