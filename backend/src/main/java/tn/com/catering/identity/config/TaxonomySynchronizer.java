package tn.com.catering.identity.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.entities.Category;
import tn.com.catering.identity.repositories.CategoryRepository;

/**
 * Makes the {@code categories} table match {@code classpath:catalog/taxonomy.json}
 * at every start: three levels (division, category, sub-category), in the
 * file's order.
 *
 * <p>Categories missing from the file are deleted; the others are created or
 * updated in place, keeping a division's accent, image and icon. Products are
 * not touched: a product whose subcategory id is no longer in the tree stays
 * in its division until an administrator files it again. Running it twice
 * changes nothing the second time.
 */
@Component
@Order(3)
public class TaxonomySynchronizer implements ApplicationRunner {

    static final String RESOURCE = "catalog/taxonomy.json";
    private static final Logger LOGGER = LoggerFactory.getLogger(TaxonomySynchronizer.class);

    private final CategoryRepository categories;
    private final ObjectMapper json;
    private final boolean enabled;

    public TaxonomySynchronizer(CategoryRepository categories, ObjectMapper json,
                                @Value("${app.catalog.sync-taxonomy:true}") boolean enabled) {
        this.categories = categories;
        this.json = json;
        this.enabled = enabled;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (enabled) synchronize();
    }

    /** Callers must hold a transaction; {@link #run} does. */
    void synchronize() throws IOException {
        Map<String, Row> wanted = rows();

        List<Category> obsolete = categories.findAll().stream()
                .filter(category -> !wanted.containsKey(category.getExternalId()))
                .toList();
        // Removed first, so that a freed slug can be reused by a new category.
        categories.deleteAll(obsolete);
        categories.flush();

        int created = 0;
        int updated = 0;
        for (Row row : wanted.values()) {
            Category category = categories.findByExternalId(row.id()).orElse(null);
            if (category == null) {
                category = new Category(row.id(), row.id(), row.nameFr());
                created++;
            } else if (changed(category, row)) {
                updated++;
            }
            category.setSlug(row.id());
            category.setNameFr(row.nameFr());
            category.setNameEn(row.nameEn());
            category.setParentExternalId(row.parentId());
            category.setSortOrder(row.position());
            categories.save(category);
        }
        if (created + updated + obsolete.size() > 0) {
            LOGGER.info("Taxonomy synchronized: {} categories ({} created, {} updated, {} removed).",
                    wanted.size(), created, updated, obsolete.size());
        }
    }

    private static boolean changed(Category category, Row row) {
        return !row.id().equals(category.getSlug())
                || !row.nameFr().equals(category.getNameFr())
                || !java.util.Objects.equals(row.nameEn(), category.getNameEn())
                || !java.util.Objects.equals(row.parentId(), category.getParentExternalId())
                || !java.util.Objects.equals(row.position(), category.getSortOrder());
    }

    private static void flatten(Node node, String parentId, int position, Map<String, Row> into) {
        if (into.put(node.id(), new Row(node.id(), node.nameFr(), node.nameEn(), parentId, position)) != null) {
            throw new IllegalStateException("Duplicate category id in " + RESOURCE + ": " + node.id());
        }
        List<Node> children = node.children() == null ? List.of() : node.children();
        for (int index = 0; index < children.size(); index++) flatten(children.get(index), node.id(), index, into);
    }

    Taxonomy read() throws IOException {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            return json.readValue(in, Taxonomy.class);
        }
    }

    /** Every category of the file, depth first, each with its position among its siblings. */
    private Map<String, Row> rows() throws IOException {
        Map<String, Row> rows = new LinkedHashMap<>();
        List<Node> divisions = read().divisions();
        for (int index = 0; index < divisions.size(); index++) flatten(divisions.get(index), null, index, rows);
        return rows;
    }

    /** Every category id of the file, depth first, for tests and tooling. */
    public List<String> ids() throws IOException {
        return new ArrayList<>(rows().keySet());
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Taxonomy(List<Node> divisions) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Node(String id, String nameFr, String nameEn, List<Node> children) {}

    private record Row(String id, String nameFr, String nameEn, String parentId, int position) {}
}
