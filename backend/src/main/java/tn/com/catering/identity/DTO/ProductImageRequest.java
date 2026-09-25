package tn.com.catering.identity.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProductImageRequest(
        @NotBlank(message = "Le chemin de l'image est obligatoire.")
        @Size(max = 500)
        String src,

        @NotBlank(message = "Le texte alternatif en français est obligatoire.")
        @Size(max = 500)
        String altFr,

        @Size(max = 500)
        String altEn,

        Integer width,

        Integer height) {}
