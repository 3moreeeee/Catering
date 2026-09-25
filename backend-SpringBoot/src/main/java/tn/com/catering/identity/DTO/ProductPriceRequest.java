package tn.com.catering.identity.DTO;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

/**
 * Targeted price update.
 *
 * <p>A null price clears the price and returns the reference to "prix sur
 * demande", which is a legitimate administrative action and the reason this
 * endpoint exists separately from the full product update.
 */
public record ProductPriceRequest(
        @DecimalMin(value = "0.000", message = "Le prix ne peut pas être négatif.")
        @Digits(integer = 7, fraction = 3, message = "Le prix doit être exprimé en dinars avec au plus trois décimales.")
        BigDecimal price,

        @Pattern(regexp = "[A-Z]{3}", message = "La devise doit être un code ISO à trois lettres.")
        String currency,

        @Min(value = 0, message = "Le stock ne peut pas être négatif.")
        Integer stockQuantity) {}
