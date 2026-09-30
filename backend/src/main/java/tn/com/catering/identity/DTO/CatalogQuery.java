package tn.com.catering.identity.DTO;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * A public catalogue query, normalised once at the edge.
 *
 * <p>The page size is a hard server rule: whatever the client asks for, a page
 * holds at most {@link #MAX_PAGE_SIZE} products, so no caller can pull the
 * catalogue in one response. Pages are zero-based, like Spring Data.
 */
public record CatalogQuery(
        List<String> terms,
        List<String> categories,
        List<String> subcategories,
        List<String> brands,
        List<String> industries,
        List<String> sizes,
        String sort,
        boolean anyTerm,
        int page,
        int pageSize) {

    public static final int DEFAULT_PAGE_SIZE = 12;
    public static final int MAX_PAGE_SIZE = 12;
    public static final Set<String> SORTS = Set.of("relevance", "name-asc", "name-desc", "category");

    public CatalogQuery {
        terms = List.copyOf(terms);
        categories = List.copyOf(categories);
        subcategories = List.copyOf(subcategories);
        brands = List.copyOf(brands);
        industries = List.copyOf(industries);
        sizes = List.copyOf(sizes);
    }

    /**
     * @param match "any" ranks products matching any search term (the
     *              assistant's retrieval); anything else requires every term.
     */
    public static CatalogQuery of(String q, List<String> categories, List<String> subcategories,
                                  List<String> brands, List<String> industries, List<String> sizes,
                                  String sort, String match, Integer page, Integer pageSize) {
        return new CatalogQuery(
                terms(q),
                values(categories), values(subcategories), values(brands), values(industries), values(sizes),
                sort != null && SORTS.contains(sort) ? sort : "relevance",
                "any".equals(match),
                page == null ? 0 : Math.max(page, 0),
                clampPageSize(pageSize));
    }

    public static int clampPageSize(Integer requested) {
        if (requested == null) return DEFAULT_PAGE_SIZE;
        return Math.clamp(requested, 1, MAX_PAGE_SIZE);
    }

    /** The same query with one facet's own filter removed, for its counts. */
    public CatalogQuery without(String facet) {
        return new CatalogQuery(terms,
                "categories".equals(facet) ? List.of() : categories,
                "subcategories".equals(facet) ? List.of() : subcategories,
                "brands".equals(facet) ? List.of() : brands,
                "industries".equals(facet) ? List.of() : industries,
                "sizes".equals(facet) ? List.of() : sizes,
                sort, anyTerm, page, pageSize);
    }

    /** Lower case without diacritics, so "cafe" matches "Café" (mirrors the storefront). */
    public static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }

    private static List<String> terms(String q) {
        String normalized = normalize(q);
        if (normalized.isEmpty()) return List.of();
        // A search box is not a query language: at most eight terms, each bounded.
        return Arrays.stream(normalized.split("\\s+"))
                .filter(term -> !term.isBlank())
                .map(term -> term.length() > 60 ? term.substring(0, 60) : term)
                .distinct()
                .limit(8)
                .toList();
    }

    private static List<String> values(List<String> raw) {
        if (raw == null) return List.of();
        return raw.stream()
                .flatMap(value -> Arrays.stream(value.split(",")))
                .map(String::trim)
                .filter(value -> !value.isEmpty() && value.length() <= 80)
                .distinct()
                .limit(20)
                .toList();
    }
}
