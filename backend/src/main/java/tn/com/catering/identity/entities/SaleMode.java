package tn.com.catering.identity.entities;

/**
 * How a product is sold.
 *
 * <p>{@link #UNIT}: one cart quantity is one sale unit at {@code price}. Every
 * product that existed before pack pricing is a UNIT product, because its price
 * was already the price of what one "1" in the panier buys (for an imported
 * "LES 250 PIÈCES" reference, the whole lot).
 *
 * <p>{@link #PACK_ONLY}: the administrator publishes a price per piece and a pack
 * size; the product is only sold by whole packs, one cart quantity is one pack,
 * and the pack price is always {@code unitPrice × packQuantity}, computed on the
 * server.
 */
public enum SaleMode {
    UNIT,
    PACK_ONLY
}
