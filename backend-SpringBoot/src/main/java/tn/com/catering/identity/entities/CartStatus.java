package tn.com.catering.identity.entities;

/**
 * A person has at most one OPEN cart. Submitting it freezes its lines into a
 * Quote and moves it to CONVERTED, so the cart is never mutated after the fact
 * and the next add-to-cart starts a fresh one.
 */
public enum CartStatus {
    OPEN,
    CONVERTED,
    ABANDONED
}
