package tn.com.catering.identity.services.impl;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.QuoteMapper;
import tn.com.catering.identity.DTO.QuoteResponse;
import tn.com.catering.identity.DTO.QuoteStatusRequest;
import tn.com.catering.identity.common.ApiException;
import tn.com.catering.identity.entities.Quote;
import tn.com.catering.identity.entities.QuoteStatus;
import tn.com.catering.identity.repositories.QuoteRepository;
import tn.com.catering.identity.services.QuoteService;

@Service
@Transactional
public class QuoteServiceImpl implements QuoteService {

    private static final int MAX_PAGE_SIZE = 100;

    private final QuoteRepository quotes;
    private final QuoteMapper mapper;

    public QuoteServiceImpl(QuoteRepository quotes, QuoteMapper mapper) {
        this.quotes = quotes;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuoteResponse> mine(UUID personId) {
        return quotes.findByPersonIdOrderByCreatedAtDesc(personId).stream().map(mapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public QuoteResponse byId(UUID personId, boolean admin, UUID quoteId) {
        Quote quote = quotes.findById(quoteId).orElseThrow(QuoteServiceImpl::notFound);
        // A quote that is not the caller's reads as absent rather than forbidden,
        // so the endpoint cannot be used to probe which references exist.
        if (!admin && !quote.getPersonId().equals(personId)) throw notFound();
        return mapper.toResponse(quote);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<QuoteResponse> all(QuoteStatus status, int page, int pageSize) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.clamp(pageSize, 1, MAX_PAGE_SIZE));
        return PageResponse.of((status == null
                ? quotes.findAllByOrderByCreatedAtDesc(pageable)
                : quotes.findByStatusOrderByCreatedAtDesc(status, pageable))
                .map(mapper::toResponse));
    }

    @Override
    public QuoteResponse updateStatus(UUID quoteId, QuoteStatusRequest request) {
        Quote quote = quotes.findById(quoteId).orElseThrow(QuoteServiceImpl::notFound);
        if (quote.getStatus() == QuoteStatus.CLOSED && request.status() != QuoteStatus.CLOSED) {
            throw new ApiException(HttpStatus.CONFLICT, "quote_closed",
                    "Une demande clôturée ne peut pas être rouverte.");
        }
        quote.setStatus(request.status());
        if (request.adminNote() != null) quote.setAdminNote(request.adminNote());
        return mapper.toResponse(quote);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "quote_not_found", "Demande de devis introuvable.");
    }
}
