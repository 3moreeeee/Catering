package tn.com.catering.identity.aiimport;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The closed lists the model must choose from: divisions with their
 * subcategories, brands, industries and unit labels. Anything outside them is
 * dropped or rejected by {@link ProductDraftParser}, so a model can never invent
 * a category the storefront cannot display.
 */
public record ImportTaxonomy(List<CategoryOption> categories, List<BrandOption> brands) {

    /** The storefront's sectors (frontend/src/app/data/industries.data.ts). */
    public static final List<String> INDUSTRIES = List.of(
            "restaurants", "hotels", "retail", "food-production", "healthcare", "pharmaceutical");

    /** Mirrors the unitLabel pattern on ProductRequest. */
    public static final List<String> UNIT_LABELS = List.of(
            "piece", "gobelet", "barquette", "sachet", "boite", "rouleau", "bouteille",
            "paire", "feuille", "bol", "pot", "paille", "pique", "sac", "can");

    public record CategoryOption(String id, String nameFr, List<SubcategoryOption> subcategories) {}

    public record SubcategoryOption(String id, String nameFr) {}

    public record BrandOption(String id, String name) {}

    public boolean isDivision(String id) {
        return id != null && categories.stream().anyMatch(category -> category.id().equals(id));
    }

    public boolean isSubcategoryOf(String subcategoryId, String divisionId) {
        return subcategoryId != null && categories.stream()
                .filter(category -> category.id().equals(divisionId))
                .flatMap(category -> category.subcategories().stream())
                .anyMatch(sub -> sub.id().equals(subcategoryId));
    }

    /** Brand ids by lower-cased id and name, so "MONIN" and "monin" both resolve. */
    public Map<String, String> brandLookup() {
        return brands.stream().flatMap(brand -> java.util.stream.Stream.of(
                        Map.entry(brand.id().toLowerCase(), brand.id()),
                        Map.entry(brand.name().toLowerCase(), brand.id())))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a));
    }

    public Set<String> brandIds() {
        return brands.stream().map(BrandOption::id).collect(Collectors.toSet());
    }
}
