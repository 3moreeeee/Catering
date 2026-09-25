package tn.com.catering.identity.entities;

/**
 * What the buyer asked for when submitting the panier.
 *
 * <p>{@link #ORDER} is a direct purchase at the displayed prices; {@link #QUOTE}
 * is a request for a negotiated offer, typically for large quantities. Neither
 * takes a payment on the site: both land in the same back-office inbox, and the
 * commercial team confirms delivery and settlement off-platform.
 */
public enum QuoteKind {
    QUOTE,
    ORDER
}
