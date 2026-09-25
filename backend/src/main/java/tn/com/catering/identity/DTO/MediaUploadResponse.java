package tn.com.catering.identity.DTO;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Public ImageKit metadata persisted with a product; no credential is exposed. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MediaUploadResponse(String url, Integer width, Integer height) {}
