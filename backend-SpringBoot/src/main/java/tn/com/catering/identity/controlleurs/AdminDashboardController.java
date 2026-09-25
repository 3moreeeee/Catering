package tn.com.catering.identity.controlleurs;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;
import java.util.UUID;
import tn.com.catering.identity.DTO.OfferRequest;
import tn.com.catering.identity.DTO.DashboardStatsResponse;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.ProductResponse;
import tn.com.catering.identity.DTO.MediaUploadResponse;
import tn.com.catering.identity.services.DashboardService;
import tn.com.catering.identity.services.ImageKitUploadService;

/**
 * Back-office reads.
 *
 * <p>Kept under /api/admin rather than /api/products/admin: the public
 * catalogue matcher permits GET /api/products/*, and "admin" would also be
 * readable as a product slug there.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {

    private final DashboardService dashboard;
    private final ImageKitUploadService media;

    public AdminDashboardController(DashboardService dashboard, ImageKitUploadService media) {
        this.dashboard = dashboard;
        this.media = media;
    }

    @GetMapping("/stats")
    DashboardStatsResponse stats() {
        return dashboard.stats();
    }

    @GetMapping("/products")
    PageResponse<ProductResponse> products(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priced,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return dashboard.products(q, category, status, priced, page, pageSize);
    }

    @GetMapping("/offers")
    PageResponse<ProductResponse> offers(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return dashboard.offers(q, page, pageSize);
    }

    @PutMapping("/offers/{productId}")
    ProductResponse saveOffer(@PathVariable UUID productId, @Valid @RequestBody OfferRequest request) {
        return dashboard.saveOffer(productId, request);
    }

    @DeleteMapping("/offers/{productId}")
    ResponseEntity<Void> deleteOffer(@PathVariable UUID productId) {
        dashboard.deleteOffer(productId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping(value = "/media/product-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    MediaUploadResponse uploadProductImage(@RequestPart("file") MultipartFile file) {
        return media.uploadProductImage(file);
    }
}
