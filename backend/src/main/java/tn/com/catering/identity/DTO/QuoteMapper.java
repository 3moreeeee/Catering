package tn.com.catering.identity.DTO;

import org.springframework.stereotype.Component;
import tn.com.catering.identity.entities.Quote;
import tn.com.catering.identity.entities.QuoteLine;

@Component
public class QuoteMapper {

    public QuoteResponse toResponse(Quote quote) {
        return new QuoteResponse(
                quote.getId(),
                quote.getReference(),
                quote.getStatus(),
                quote.getKind(),
                quote.getContactEmail(),
                quote.getContactName(),
                quote.getCompanyName(),
                quote.getContactPhone(),
                quote.getDeliveryCity(),
                quote.getMessage(),
                quote.getAdminNote(),
                quote.getTotalAmount(),
                quote.getCurrency(),
                quote.isHasUnpricedLines(),
                quote.getLines().stream().map(this::toResponse).toList(),
                quote.getCreatedAt(),
                quote.getUpdatedAt());
    }

    public QuoteLineResponse toResponse(QuoteLine line) {
        return new QuoteLineResponse(
                line.getId(),
                line.getProduct() == null ? null : line.getProduct().getId(),
                line.getProductSourceId(),
                line.getProductName(),
                line.getSupplierReference(),
                line.getFormatValue(),
                line.getQuantity(),
                line.getUnitPrice(),
                line.getLineTotal());
    }
}
