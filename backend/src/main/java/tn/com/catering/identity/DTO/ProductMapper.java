package tn.com.catering.identity.DTO;

import java.util.List;
import org.springframework.stereotype.Component;
import tn.com.catering.identity.entities.Brand;
import tn.com.catering.identity.entities.Category;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.entities.ProductFormat;
import tn.com.catering.identity.entities.ProductImage;

/**
 * Hand-written mapping, deliberately: the entity/DTO shapes differ enough
 * (bilingual pairs, nested subcategories) that a generated mapper would need as
 * much configuration as this is code.
 */
@Component
public class ProductMapper {

    public ProductResponse toResponse(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getSourceId(),
                product.getSlug(),
                LocalizedText.of(product.getNameFr(), product.getNameEn()),
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
                LocalizedText.of(product.getSeoTitleFr(), product.getSeoTitleEn()),
                LocalizedText.of(product.getSeoDescriptionFr(), product.getSeoDescriptionEn()),
                product.getImages().stream().map(this::toResponse).toList(),
                product.getFormats().stream().map(this::toResponse).toList(),
                product.getCreatedAt(),
                product.getUpdatedAt());
    }

    public ProductImageResponse toResponse(ProductImage image) {
        return new ProductImageResponse(
                image.getSrc(),
                LocalizedText.of(image.getAltFr(), image.getAltEn()),
                image.getWidth(),
                image.getHeight());
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
