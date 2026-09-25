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
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.ProductPricePoint;
import tn.com.catering.identity.DTO.ProductPriceRequest;
import tn.com.catering.identity.DTO.ProductRequest;
import tn.com.catering.identity.DTO.ProductResponse;
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

    public ProductController(ProductService products) {
        this.products = products;
    }

    @GetMapping
    PageResponse<ProductResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String subcategory,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) Boolean featured,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int pageSize) {
        return products.search(q, category, subcategory, brand, featured, sort, page, pageSize);
    }

    @GetMapping("/{slug}")
    ProductResponse bySlug(@PathVariable String slug) {
        return products.bySlug(slug);
    }

    /**
     * Live prices for a batch of catalogue ids. Public, like the rest of the
     * catalogue reads, and the bridge the storefront uses while it still browses
     * the bundled snapshot.
     */
    @GetMapping("/prices")
    List<ProductPricePoint> prices(@RequestParam List<String> sourceIds) {
        return products.prices(sourceIds);
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
