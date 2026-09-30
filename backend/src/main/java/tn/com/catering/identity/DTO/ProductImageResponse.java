package tn.com.catering.identity.DTO;

public record ProductImageResponse(
        String src,
        LocalizedText alt,
        Integer width,
        Integer height,
        /** Null when the photograph has not been measured (for example a fresh admin upload). */
        ImageMetricsResponse metrics) {}
