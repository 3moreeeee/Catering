package tn.com.catering.identity.DTO;

import jakarta.validation.constraints.Size;
import tn.com.catering.identity.entities.QuoteKind;

/**
 * Optional context supplied when converting a panier into an order or a demande
 * de devis.
 *
 * <p>Every field may be omitted: the contact details default to the ones already
 * on the authenticated account, and a missing {@code kind} means a quote request.
 * An {@link QuoteKind#ORDER} additionally needs a phone and a delivery city,
 * which the service enforces after applying the account defaults.
 */
public record QuoteSubmitRequest(
        @Size(max = 200) String contactName,
        @Size(max = 180) String companyName,
        @Size(max = 30) String contactPhone,
        @Size(max = 120) String deliveryCity,
        @Size(max = 2000) String message,
        QuoteKind kind) {}
