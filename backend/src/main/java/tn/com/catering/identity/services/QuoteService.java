package tn.com.catering.identity.services;

import java.util.List;
import java.util.UUID;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.QuoteResponse;
import tn.com.catering.identity.DTO.QuoteStatusRequest;
import tn.com.catering.identity.entities.QuoteStatus;

public interface QuoteService {

    List<QuoteResponse> mine(UUID personId);

    /** Ownership is checked in the service: a client may only read their own. */
    QuoteResponse byId(UUID personId, boolean admin, UUID quoteId);

    PageResponse<QuoteResponse> all(QuoteStatus status, int page, int pageSize);

    QuoteResponse updateStatus(UUID quoteId, QuoteStatusRequest request);
}
