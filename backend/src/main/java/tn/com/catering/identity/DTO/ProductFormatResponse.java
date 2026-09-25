package tn.com.catering.identity.DTO;

public record ProductFormatResponse(
        String id,
        String value,
        Integer packQuantity,
        String sizeBucket,
        String reference) {}
