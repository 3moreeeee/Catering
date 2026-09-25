package tn.com.catering.identity.DTO;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Admin payload for creating or replacing a product.
 *
 * <p>{@code price} is intentionally optional: the administrator must be able to
 * publish a reference the company has not priced yet, and leaving it null is the
 * supported way to say so. It is validated only for shape, never defaulted.
 */
public record ProductRequest(
        @NotBlank(message = "La référence interne est obligatoire.")
        @Size(max = 120)
        String sourceId,

        @NotBlank(message = "Le slug est obligatoire.")
        @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*", message = "Le slug ne peut contenir que des minuscules, des chiffres et des tirets.")
        @Size(max = 200)
        String slug,

        @NotBlank(message = "Le nom en français est obligatoire.")
        @Size(max = 255)
        String nameFr,

        @Size(max = 255)
        String nameEn,

        @Size(max = 1000)
        String shortDescriptionFr,

        @Size(max = 1000)
        String shortDescriptionEn,

        @Size(max = 4000)
        String descriptionFr,

        @Size(max = 4000)
        String descriptionEn,

        @NotBlank(message = "La catégorie est obligatoire.")
        @Size(max = 80)
        String categoryId,

        @Size(max = 80)
        String subcategoryId,

        @Size(max = 80)
        String brandId,

        List<String> industries,

        @DecimalMin(value = "0.000", inclusive = true, message = "Le prix ne peut pas être négatif.")
        @Digits(integer = 7, fraction = 3, message = "Le prix doit être exprimé en dinars avec au plus trois décimales.")
        BigDecimal price,

        @Pattern(regexp = "[A-Z]{3}", message = "La devise doit être un code ISO à trois lettres.")
        String currency,

        @Min(value = 0, message = "Le stock ne peut pas être négatif.")
        Integer stockQuantity,

        @Size(max = 120)
        String reference,

        @Size(max = 500)
        String technicalSheetUrl,

        boolean featured,

        boolean needsVerification,

        @Size(max = 255)
        String seoTitleFr,

        @Size(max = 255)
        String seoTitleEn,

        @Size(max = 1000)
        String seoDescriptionFr,

        @Size(max = 1000)
        String seoDescriptionEn,

        @Valid List<ProductImageRequest> images,

        @Valid List<ProductFormatRequest> formats) {}
