package tn.com.catering.identity.controlleurs;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.com.catering.identity.common.PublicCatalogueCache;
import tn.com.catering.identity.DTO.BrandResponse;
import tn.com.catering.identity.DTO.CategoryResponse;
import tn.com.catering.identity.services.ProductService;

/**
 * Categories and brands, both public reads.
 *
 * <p>They share a controller because they are the same concern - the facets the
 * catalogue filters on - and neither is large enough to warrant its own.
 */
@RestController
public class TaxonomyController {

    private final ProductService products;

    public TaxonomyController(ProductService products) {
        this.products = products;
    }

    @GetMapping("/api/categories")
    ResponseEntity<List<CategoryResponse>> categories() {
        return PublicCatalogueCache.ok(products.categories());
    }

    @GetMapping("/api/brands")
    ResponseEntity<List<BrandResponse>> brands() {
        return PublicCatalogueCache.ok(products.brands());
    }
}
