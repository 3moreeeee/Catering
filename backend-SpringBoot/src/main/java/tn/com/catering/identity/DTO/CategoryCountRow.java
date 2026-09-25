package tn.com.catering.identity.DTO;

/**
 * Flat carrier for the grouped catalogue query.
 *
 * <p>Deliberately not {@link CategoryCountResponse}: JPQL constructor
 * expressions cannot reliably nest, so the query selects plain columns and the
 * service assembles the bilingual {@link LocalizedText} afterwards, where the
 * "English falls back to French" rule in {@link LocalizedText#of} still applies.
 */
public record CategoryCountRow(String externalId, String nameFr, String nameEn, long products) {}
