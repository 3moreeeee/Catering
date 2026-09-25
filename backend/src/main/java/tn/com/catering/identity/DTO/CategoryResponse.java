package tn.com.catering.identity.DTO;

import java.util.List;
import java.util.UUID;

public record CategoryResponse(
        UUID id,
        String externalId,
        String slug,
        LocalizedText name,
        String accent,
        String image,
        String icon,
        List<CategoryResponse> subcategories) {}
