package tn.com.catering.identity.DTO;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CartItemQuantityRequest(
        @NotNull(message = "La quantité est obligatoire.")
        @Min(value = 1, message = "La quantité doit être au moins 1.")
        @Max(value = 100000, message = "La quantité demandée est trop élevée.")
        Integer quantity) {}
