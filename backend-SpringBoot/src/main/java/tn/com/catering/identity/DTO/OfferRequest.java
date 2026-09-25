package tn.com.catering.identity.DTO;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;

/** Creates or replaces the promotion attached to one product. */
public record OfferRequest(
        @NotNull @DecimalMin(value = "0.001") @Digits(integer = 7, fraction = 3) BigDecimal offerPrice,
        Instant startsAt,
        Instant endsAt,
        boolean active) {}
