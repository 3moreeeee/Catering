package tn.com.catering.identity.DTO;

import java.util.UUID;

public record BrandResponse(
        UUID id,
        String externalId,
        String slug,
        String name,
        String logo,
        LocalizedText description,
        String website) {}
