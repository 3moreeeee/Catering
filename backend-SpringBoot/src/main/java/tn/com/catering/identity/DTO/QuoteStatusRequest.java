package tn.com.catering.identity.DTO;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tn.com.catering.identity.entities.QuoteStatus;

public record QuoteStatusRequest(
        @NotNull(message = "Le statut est obligatoire.")
        QuoteStatus status,

        @Size(max = 2000)
        String adminNote) {}
