package tn.com.catering.identity.DTO;

/**
 * How many active products sit in one division.
 *
 * <p>Built by a grouped query rather than counted in Java so the figure stays
 * correct as the catalogue grows past a page.
 */
public record CategoryCountResponse(String categoryId, LocalizedText name, long products) {}
