package tn.com.catering.identity.aiimport;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.entities.Category;
import tn.com.catering.identity.repositories.BrandRepository;
import tn.com.catering.identity.repositories.CategoryRepository;
import tn.com.catering.identity.repositories.ProductRepository;

/** Reads the live taxonomy and product names the importer validates and matches against. */
@Component
public class ImportTaxonomyLoader {

    private final CategoryRepository categories;
    private final BrandRepository brands;
    private final ProductRepository products;

    public ImportTaxonomyLoader(CategoryRepository categories, BrandRepository brands, ProductRepository products) {
        this.categories = categories;
        this.brands = brands;
        this.products = products;
    }

    @Transactional(readOnly = true)
    public ImportTaxonomy taxonomy() {
        List<Category> all = categories.findAll();
        Map<String, List<Category>> children = all.stream()
                .filter(category -> category.getParentExternalId() != null)
                .collect(Collectors.groupingBy(Category::getParentExternalId));
        Comparator<Category> order = Comparator
                .comparing(Category::getSortOrder, Comparator.nullsLast(Integer::compare))
                .thenComparing(Category::getExternalId);
        // Both lower levels are offered, the sub-category written as
        // "Verres et gobelets › Gobelets en PET", so the model can file a
        // product as precisely as the tree allows.
        List<ImportTaxonomy.CategoryOption> divisions = all.stream()
                .filter(category -> category.getParentExternalId() == null)
                .sorted(order)
                .map(division -> new ImportTaxonomy.CategoryOption(
                        division.getExternalId(), division.getNameFr(),
                        children.getOrDefault(division.getExternalId(), List.of()).stream()
                                .sorted(order)
                                .flatMap(category -> java.util.stream.Stream.concat(
                                        java.util.stream.Stream.of(new ImportTaxonomy.SubcategoryOption(
                                                category.getExternalId(), category.getNameFr())),
                                        children.getOrDefault(category.getExternalId(), List.of()).stream()
                                                .sorted(order)
                                                .map(sub -> new ImportTaxonomy.SubcategoryOption(sub.getExternalId(),
                                                        category.getNameFr() + " › " + sub.getNameFr()))))
                                .toList()))
                .toList();
        List<ImportTaxonomy.BrandOption> brandOptions = brands.findAllByOrderByNameAsc().stream()
                .map(brand -> new ImportTaxonomy.BrandOption(brand.getExternalId(), brand.getName()))
                .toList();
        return new ImportTaxonomy(divisions, brandOptions);
    }

    /** Every catalogue product, active or not: re-importing a deactivated reference should still match it. */
    @Transactional(readOnly = true)
    public List<ProductMatcher.Candidate> candidates() {
        return products.findAll().stream()
                .map(product -> new ProductMatcher.Candidate(product.getId(), product.getNameFr()))
                .toList();
    }

    @Transactional(readOnly = true)
    public String productName(UUID id) {
        return products.findById(id).map(product -> product.getNameFr()).orElse(null);
    }
}
