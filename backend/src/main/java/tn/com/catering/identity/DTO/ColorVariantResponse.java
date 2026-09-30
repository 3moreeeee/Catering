package tn.com.catering.identity.DTO;

/** One colour of a supplier line shown once in the catalogue; {@code id} is the SKU's source id. */
public record ColorVariantResponse(String id, String slug, LocalizedText label, String swatch) {}
