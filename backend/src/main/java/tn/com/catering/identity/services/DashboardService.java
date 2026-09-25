package tn.com.catering.identity.services;

import tn.com.catering.identity.DTO.DashboardStatsResponse;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.ProductResponse;
import tn.com.catering.identity.DTO.OfferRequest;
import java.util.UUID;

public interface DashboardService {

    DashboardStatsResponse stats();

    /**
     * Back-office product listing, including deactivated products.
     *
     * @param status "active", "inactive" or anything else for both
     * @param priced "yes", "no" or anything else for both
     */
    PageResponse<ProductResponse> products(
            String q, String category, String status, String priced, int page, int pageSize);

    PageResponse<ProductResponse> offers(String q, int page, int pageSize);

    ProductResponse saveOffer(UUID productId, OfferRequest request);

    void deleteOffer(UUID productId);
}
