package tn.com.catering.identity.DTO;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import tn.com.catering.identity.entities.QuoteKind;
import tn.com.catering.identity.entities.QuoteStatus;

public record QuoteResponse(
        UUID id,
        String reference,
        QuoteStatus status,
        QuoteKind kind,
        String contactEmail,
        String contactName,
        String companyName,
        String contactPhone,
        String deliveryCity,
        String message,
        String adminNote,
        BigDecimal totalAmount,
        String currency,
        boolean hasUnpricedLines,
        List<QuoteLineResponse> lines,
        Instant createdAt,
        Instant updatedAt) {}
