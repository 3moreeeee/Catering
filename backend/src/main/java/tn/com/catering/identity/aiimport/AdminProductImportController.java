package tn.com.catering.identity.aiimport;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tn.com.catering.identity.aiimport.ProductImportDtos.ItemResponse;
import tn.com.catering.identity.aiimport.ProductImportDtos.ListResponse;
import tn.com.catering.identity.aiimport.ProductImportDtos.PublishRequest;
import tn.com.catering.identity.aiimport.ProductImportDtos.UpdateRequest;

/** The AI product importer, administrator only. */
@RestController
@RequestMapping("/api/admin/imports")
@PreAuthorize("hasRole('ADMIN')")
public class AdminProductImportController {

    private final ProductImportService imports;

    public AdminProductImportController(ProductImportService imports) {
        this.imports = imports;
    }

    /** {@code status}: ACTIVE (default: queued, processing, ready, failed), ALL, or one status. */
    @GetMapping
    ListResponse list(@RequestParam(required = false) String status) {
        return imports.list(status);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<List<ItemResponse>> upload(
            // Optional here so that a request without a file gets the service's
            // 400 "image_required" rather than an unhandled 500.
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        return ResponseEntity.status(HttpStatus.CREATED).body(imports.enqueue(files));
    }

    @PutMapping("/{id}")
    ItemResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest request) {
        return imports.update(id, request);
    }

    @PostMapping("/{id}/publish")
    ItemResponse publish(@PathVariable UUID id, @Valid @RequestBody PublishRequest request) {
        return imports.publish(id, request);
    }

    @PostMapping("/{id}/retry")
    ItemResponse retry(@PathVariable UUID id) {
        return imports.retry(id);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> discard(@PathVariable UUID id) {
        imports.discard(id);
        return ResponseEntity.noContent().build();
    }

    // --- price lists ------------------------------------------------------------------

    @GetMapping("/price-lists")
    List<ProductImportDtos.PriceListResponse> priceLists() {
        return imports.priceLists();
    }

    @PostMapping(value = "/price-lists", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    List<ProductImportDtos.PriceListResponse> uploadPriceLists(
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        return imports.uploadPriceLists(files);
    }

    @DeleteMapping("/price-lists")
    ResponseEntity<Void> deletePriceList(@RequestParam String listName) {
        imports.deletePriceList(listName);
        return ResponseEntity.noContent().build();
    }
}
