package tn.com.catering.identity.controlleurs;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tn.com.catering.identity.common.PublicCatalogueCache;
import tn.com.catering.identity.DTO.CatalogQuery;
import tn.com.catering.identity.DTO.CatalogStatsResponse;
import tn.com.catering.identity.DTO.FacetSetResponse;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.ProductPricePoint;
import tn.com.catering.identity.DTO.ProductPriceRequest;
import tn.com.catering.identity.DTO.ProductRequest;
import tn.com.catering.identity.DTO.ProductResponse;
import tn.com.catering.identity.DTO.SitemapEntryResponse;
import tn.com.catering.identity.services.CatalogueQueryService;
import tn.com.catering.identity.services.ProductService;

/**
 * Catalogue endpoints.
 *
 * <p>Reads are public - the catalogue is the marketing surface and is
 * server-rendered for anonymous visitors. Writes are administrator-only.
 */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService products;
    private final CatalogueQueryService catalogue;

    public ProductController(ProductService products, CatalogueQueryService catalogue) {
        this.products = products;
        this.catalogue = catalogue;
    }

    /**
     * One page of the public catalogue, filtered, searched and sorted by the
     * database. Multi-valued filters accept comma-separated or repeated values.
     * {@code pageSize} is capped at 12 whatever the caller asks for; pages are
     * zero-based.
     */
    @GetMapping
    ResponseEntity<PageResponse<ProductResponse>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> subcategory,
            @RequestParam(required = false) List<String> brand,
            @RequestParam(required = false) List<String> industry,
            @RequestParam(required = false) List<String> size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String match,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize) {
        return PublicCatalogueCache.ok(catalogue.search(
                CatalogQuery.of(q, category, subcategory, brand, industry, size, sort, match, page, pageSize)));
    }

    /** Facet counts for the same filters, each facet counted with its own filter removed. */
    @GetMapping("/facets")
    ResponseEntity<FacetSetResponse> facets(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> subcategory,
            @RequestParam(required = false) List<String> brand,
            @RequestParam(required = false) List<String> industry,
            @RequestParam(required = false) List<String> size) {
        return PublicCatalogueCache.ok(catalogue.facets(
                CatalogQuery.of(q, category, subcategory, brand, industry, size, null, null, 0, null)));
    }

    /** Catalogue size in total, per division and per brand. */
    @GetMapping("/stats")
    ResponseEntity<CatalogStatsResponse> stats() {
        return PublicCatalogueCache.ok(catalogue.stats());
    }

    /** The homepage showcase, at most 12 products, optionally within one division. */
    @GetMapping("/featured")
    ResponseEntity<List<ProductResponse>> featured(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer limit) {
        return PublicCatalogueCache.ok(catalogue.featured(category, limit));
    }

    /** Running and upcoming promotions, at most 12. */
    @GetMapping("/offers")
    ResponseEntity<List<ProductResponse>> offers(@RequestParam(required = false) Integer limit) {
        return PublicCatalogueCache.ok(catalogue.offers(limit));
    }

    /** Every public product URL, for the sitemap. Slugs only, no product content. */
    @GetMapping("/sitemap")
    ResponseEntity<List<SitemapEntryResponse>> sitemap() {
        return PublicCatalogueCache.ok(catalogue.sitemap());
    }

    @GetMapping("/{slug}")
    ResponseEntity<ProductResponse> bySlug(@PathVariable String slug) {
        return PublicCatalogueCache.ok(catalogue.bySlug(slug));
    }

    /** Related products, scored in the database; 4 by default, at most 12. */
    @GetMapping("/{slug}/related")
    ResponseEntity<List<ProductResponse>> related(
            @PathVariable String slug,
            @RequestParam(required = false) Integer limit) {
        return PublicCatalogueCache.ok(catalogue.related(slug, limit));
    }

    /**
     * Live prices for a batch of catalogue ids. Public, like the rest of the
     * catalogue reads; the cart and pricing read them by catalogue id.
     */
    @GetMapping("/prices")
    ResponseEntity<List<ProductPricePoint>> prices(@RequestParam List<String> sourceIds) {
        return PublicCatalogueCache.ok(products.prices(sourceIds));
    }

    @GetMapping("/id/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    ProductResponse byId(@PathVariable UUID id) {
        return products.byId(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(products.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    ProductResponse update(@PathVariable UUID id, @Valid @RequestBody ProductRequest request) {
        return products.update(id, request);
    }

    @PatchMapping("/{id}/price")
    @PreAuthorize("hasRole('ADMIN')")
    ProductResponse updatePrice(@PathVariable UUID id, @Valid @RequestBody ProductPriceRequest request) {
        return products.updatePrice(id, request);
    }

    @PostMapping("/{id}/reactivate")
    @PreAuthorize("hasRole('ADMIN')")
    ProductResponse reactivate(@PathVariable UUID id) {
        return products.reactivate(id);
    }

    /** Soft delete. Past quotes keep pointing at the product. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        products.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
