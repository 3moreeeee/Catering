package tn.com.catering.identity.DTO;

import java.util.List;

/**
 * Mirrors the Paginated<T> interface the Angular catalogue already consumes, so
 * swapping the in-memory repository for the HTTP one needs no component change.
 */
public record PageResponse<T>(
        List<T> items,
        long total,
        int page,
        int pageSize,
        int totalPages) {

    public static <T> PageResponse<T> of(org.springframework.data.domain.Page<T> page) {
        return new PageResponse<>(
                page.getContent(), page.getTotalElements(),
                page.getNumber(), page.getSize(), page.getTotalPages());
    }
}
