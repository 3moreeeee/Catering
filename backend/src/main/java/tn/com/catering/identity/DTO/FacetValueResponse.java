package tn.com.catering.identity.DTO;

/** One facet value and the number of visible products carrying it. Labels are the client's reference data. */
public record FacetValueResponse(String id, long count) {}
