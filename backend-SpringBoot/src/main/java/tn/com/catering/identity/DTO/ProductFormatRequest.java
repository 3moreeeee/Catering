package tn.com.catering.identity.DTO;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProductFormatRequest(
        @Size(max = 160)
        String id,

        @NotBlank(message = "Le format est obligatoire.")
        @Size(max = 160)
        String value,

        @Min(value = 1, message = "Le nombre d'unités par colis doit être au moins 1.")
        Integer packQuantity,

        @Size(max = 20)
        String sizeBucket,

        @Size(max = 120)
        String reference) {}
