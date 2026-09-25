package tn.com.catering.identity.DTO;

public record ProductImageResponse(
        String src,
        LocalizedText alt,
        Integer width,
        Integer height) {}
