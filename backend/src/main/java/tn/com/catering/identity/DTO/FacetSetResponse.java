package tn.com.catering.identity.DTO;

import java.util.List;

/**
 * Faceted-search counts. Each facet is counted with its own filter removed, so
 * selecting one subcategory does not zero out the others.
 */
public record FacetSetResponse(
        List<FacetValueResponse> categories,
        List<FacetValueResponse> subcategories,
        List<FacetValueResponse> brands,
        List<FacetValueResponse> industries,
        List<FacetValueResponse> sizes) {}
