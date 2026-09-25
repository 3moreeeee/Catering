package tn.com.catering.identity.DTO;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CartItemRequest(
        @NotNull(message = "Le produit est obligatoire.")
        UUID productId,

        @NotNull(message = "La quantité est obligatoire.")
        @Min(value = 1, message = "La quantité doit être au moins 1.")
        @Max(value = 100000, message = "La quantité demandée est trop élevée.")
        Integer quantity,

        @Size(max = 160)
        String formatValue) {}
