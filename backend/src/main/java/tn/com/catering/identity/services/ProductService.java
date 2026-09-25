package tn.com.catering.identity.services;

import java.util.List;
import java.util.UUID;
import tn.com.catering.identity.DTO.BrandResponse;
import tn.com.catering.identity.DTO.CategoryResponse;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.ProductPricePoint;
import tn.com.catering.identity.DTO.ProductPriceRequest;
import tn.com.catering.identity.DTO.ProductRequest;
import tn.com.catering.identity.DTO.ProductResponse;

public interface ProductService {

    PageResponse<ProductResponse> search(
            String q, String category, String subcategory, String brand,
            Boolean featured, String sort, int page, int pageSize);

    ProductResponse bySlug(String slug);

    /** Live prices for a batch of catalogue ids, for the storefront bridge. */
    List<ProductPricePoint> prices(List<String> sourceIds);

    ProductResponse byId(UUID id);

    ProductResponse create(ProductRequest request);

    ProductResponse update(UUID id, ProductRequest request);

    ProductResponse updatePrice(UUID id, ProductPriceRequest request);

    /** Soft delete: the product is deactivated so historical quotes stay readable. */
    void deactivate(UUID id);

    ProductResponse reactivate(UUID id);

    List<CategoryResponse> categories();

    List<BrandResponse> brands();
}
