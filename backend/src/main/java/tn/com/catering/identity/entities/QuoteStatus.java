package tn.com.catering.identity.entities;

/**
 * Lifecycle of a "demande de devis". There is deliberately no PAID state: the
 * site takes no payment, the commercial team answers off-platform.
 */
public enum QuoteStatus {
    SUBMITTED,
    IN_REVIEW,
    ANSWERED,
    CLOSED
}
