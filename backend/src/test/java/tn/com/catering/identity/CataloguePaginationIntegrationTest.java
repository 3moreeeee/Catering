package tn.com.catering.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.entities.ProductFormat;
import tn.com.catering.identity.entities.ProductImage;
import tn.com.catering.identity.repositories.ProductRepository;

/**
 * The public catalogue is paginated by the database, at most 12 products per
 * page whatever the client asks, with deterministic order, and every listing
 * aid (facets, stats, featured, related, sitemap) is a bounded query.
 *
 * <p>Fixture: 29 regular active products, one two-colour supplier line folded
 * into one catalogue entry, and 3 inactive products: 30 visible entries, so
 * pages of 12, 12 and 6.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:catalogue-pagination;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=test-only-secret-that-is-longer-than-thirty-two-characters",
        "app.catalog.seed-on-startup=false",
        "app.catalog.reconcile-on-startup=false"
})
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CataloguePaginationIntegrationTest {

    private static final int VISIBLE = 30;
    private static final List<String> CATEGORIES = List.of("food", "monin", "packaging", "hygiene");
    private static final Set<String> INACTIVE = Set.of("p-off-1", "p-off-2", "p-off-3");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    ProductRepository products;

    @BeforeAll
    void catalogue() {
        products.deleteAll();
        List<Product> rows = new ArrayList<>();
        for (int i = 1; i <= 27; i++) {
            String category = CATEGORIES.get(i % 4);
            Product product = product(String.format("p-t-%02d", i), String.format("Produit test %02d", i), category);
            product.setFeatured(i % 5 == 0);
            product.setBrandId(i % 3 == 0 ? "monin" : "emporium");
            product.setSubcategoryId(category + (i % 2 == 0 ? "-a" : "-b"));
            product.setIndustries(new HashSet<>(i % 2 == 0 ? Set.of("restaurants", "hotels") : Set.of("retail")));
            product.addFormat(new ProductFormat(null, i % 2 == 0 ? "70 cl" : "1 L", null, i % 2 == 0 ? "medium" : "large", null, 0));
            rows.add(product);
        }
        rows.get(0).setNameFr("Café glacé MONIN");
        rows.add(product("p-pique-perle", "Pique perle satin- LES 100 PIÈCES", "packaging"));
        rows.add(product("p-pique-p", "Pique P 13cm- LES 50 PIÈCES", "packaging"));
        rows.add(product("p-vinto-348", "Verrine goutte transparente", "packaging"));
        rows.add(product("p-vinto-183", "Verrine goutte noire", "packaging"));
        for (String id : INACTIVE) {
            Product inactive = product(id, "Produit retiré " + id, "food");
            inactive.setActive(false);
            rows.add(inactive);
        }
        products.saveAll(rows);
    }

    private static Product product(String sourceId, String name, String category) {
        Product product = new Product(sourceId, sourceId.replace("p-", "slug-"), name, category);
        product.setNameEn(name);
        product.addImage(new ProductImage("/img/products/catalogue/" + sourceId + ".v2.webp", name, name, 800, 800, 0));
        return product;
    }

    // --- The 12-product ceiling -----------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"", "&pageSize=12", "&pageSize=100", "&pageSize=1000", "&pageSize=2147483647"})
    void aPageNeverHoldsMoreThanTwelveProducts(String pageSize) throws Exception {
        JsonNode page = read("/api/products?page=0" + pageSize);
        assertThat(page.get("items").size()).isEqualTo(12);
        assertThat(page.get("pageSize").asInt()).isEqualTo(12);
        assertThat(page.get("total").asLong()).isEqualTo(VISIBLE);
        assertThat(page.get("totalPages").asInt()).isEqualTo(3);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-5"})
    void aNonPositivePageSizeStillReturnsAPage(String pageSize) throws Exception {
        JsonNode page = read("/api/products?pageSize=" + pageSize);
        assertThat(page.get("items").size()).isEqualTo(1);
    }

    @Test
    void consecutivePagesCoverTheCatalogueOnceInAStableOrder() throws Exception {
        List<String> seen = new ArrayList<>();
        int[] expectedSizes = {12, 12, 6};
        for (int page = 0; page < 3; page++) {
            JsonNode items = read("/api/products?page=" + page + "&pageSize=100").get("items");
            assertThat(items.size()).isEqualTo(expectedSizes[page]);
            items.forEach(item -> seen.add(item.get("sourceId").asText()));
        }
        assertThat(seen).hasSize(VISIBLE).doesNotHaveDuplicates().doesNotContainAnyElementsOf(INACTIVE);
        assertThat(read("/api/products?page=3").get("items").size()).isZero();
        // Same request, same order: nothing depends on physical row order.
        assertThat(read("/api/products?page=1").get("items")).isEqualTo(read("/api/products?page=1").get("items"));
        for (String sort : List.of("name-asc", "name-desc", "category")) {
            Set<String> sorted = new HashSet<>();
            for (int page = 0; page < 3; page++) {
                read("/api/products?sort=" + sort + "&page=" + page).get("items")
                        .forEach(item -> sorted.add(item.get("sourceId").asText()));
            }
            assertThat(sorted).as(sort).hasSize(VISIBLE);
        }
    }

    @Test
    void relevanceListsFeaturedProductsFirst() throws Exception {
        JsonNode items = read("/api/products").get("items");
        List<Boolean> featured = new ArrayList<>();
        items.forEach(item -> featured.add(item.get("featured").asBoolean()));
        assertThat(featured.subList(0, 5)).containsOnly(true);
        assertThat(featured.subList(5, 12)).containsOnly(false);
    }

    // --- Visibility -------------------------------------------------------------------

    @Test
    void inactiveProductsStayOutOfEveryPublicRead() throws Exception {
        mvc.perform(get("/api/products/slug-off-1")).andExpect(status().isNotFound());
        assertThat(read("/api/products/stats").get("total").asLong()).isEqualTo(VISIBLE);
        List<String> sitemap = new ArrayList<>();
        read("/api/products/sitemap").forEach(entry -> sitemap.add(entry.get("slug").asText()));
        assertThat(sitemap).hasSize(VISIBLE).doesNotContain("slug-off-1", "slug-off-2", "slug-off-3", "slug-vinto-183");
    }

    @Test
    void aColourLineIsListedOnceAndEachColourSlugOpensIt() throws Exception {
        JsonNode line = null;
        for (int page = 0; page < 3; page++) {
            for (JsonNode item : read("/api/products?category=packaging&page=" + page).get("items")) {
                assertThat(item.get("sourceId").asText()).isNotEqualTo("p-vinto-183");
                if (item.get("sourceId").asText().equals("p-vinto-348")) line = item;
            }
        }
        assertThat(line).isNotNull();
        assertThat(line.get("colorVariants").size()).isEqualTo(2);
        assertThat(line.get("name").get("fr").asText()).startsWith("Verrine goutte 11ml");

        JsonNode byOtherColour = read("/api/products/slug-vinto-183");
        assertThat(byOtherColour.get("sourceId").asText()).isEqualTo("p-vinto-348");
        assertThat(byOtherColour.get("colorVariants").get(1).get("slug").asText()).isEqualTo("slug-vinto-183");
    }

    // --- Search, filters, facets ------------------------------------------------------

    @Test
    void searchIsAccentAndCaseInsensitiveAndRequiresEveryTerm() throws Exception {
        assertThat(ids(read("/api/products?q=cafe"))).containsExactly("p-t-01");
        String accented = mvc.perform(get("/api/products").param("q", "CAFÉ monin"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(ids(json.readTree(accented))).containsExactly("p-t-01");
        assertThat(ids(read("/api/products?q=cafe%20introuvable"))).isEmpty();
        // Formats are part of the haystack.
        assertThat(read("/api/products?q=70%20cl").get("total").asLong()).isEqualTo(13);
        // LIKE wildcards in user input are literals.
        assertThat(read("/api/products?q=%25").get("total").asLong()).isZero();
    }

    @Test
    void aSearchRanksWholeWordNameMatchesFirst() throws Exception {
        // Both names contain "p"; only one has it as a word.
        assertThat(ids(read("/api/products?q=pique%20p"))).first().isEqualTo("p-pique-p");
    }

    @Test
    void theAssistantModeRanksAnyMatchingTerm() throws Exception {
        JsonNode page = read("/api/products?q=cafe%20introuvable&match=any");
        assertThat(ids(page)).first().isEqualTo("p-t-01");
    }

    @Test
    void filtersCombineAndFacetsIgnoreTheirOwnFilter() throws Exception {
        JsonNode food = read("/api/products?category=food&industry=hotels&size=medium");
        food.get("items").forEach(item -> {
            assertThat(item.get("categoryId").asText()).isEqualTo("food");
            assertThat(item.get("industries").toString()).contains("hotels");
        });
        assertThat(food.get("total").asLong()).isPositive();

        JsonNode facets = read("/api/products/facets?category=food");
        // The category facet keeps counting every division while food is selected.
        assertThat(facets.get("categories").size()).isEqualTo(4);
        long foodCount = 0;
        for (JsonNode value : facets.get("categories")) {
            if (value.get("id").asText().equals("food")) foodCount = value.get("count").asLong();
        }
        assertThat(foodCount).isEqualTo(read("/api/products?category=food").get("total").asLong());
        assertThat(facets.get("sizes").size()).isPositive();
        assertThat(facets.get("industries").size()).isPositive();
    }

    // --- Bounded selections -----------------------------------------------------------

    @Test
    void homepageRelatedAndOfferSelectionsAreBounded() throws Exception {
        assertThat(read("/api/products/featured?limit=8").size()).isEqualTo(8);
        assertThat(read("/api/products/featured?limit=500").size()).isLessThanOrEqualTo(12);
        read("/api/products/featured?category=monin&limit=5")
                .forEach(item -> assertThat(item.get("categoryId").asText()).isEqualTo("monin"));

        JsonNode related = read("/api/products/slug-t-02/related");
        assertThat(related.size()).isEqualTo(4);
        related.forEach(item -> assertThat(item.get("sourceId").asText()).isNotEqualTo("p-t-02"));
        assertThat(read("/api/products/slug-t-02/related?limit=500").size()).isLessThanOrEqualTo(12);
        assertThat(read("/api/products/offers?limit=500").size()).isLessThanOrEqualTo(12);
    }

    /** {@code url} is already percent-encoded; a URI keeps MockMvc from encoding it twice. */
    private JsonNode read(String url) throws Exception {
        String body = mvc.perform(get(URI.create(url))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private static List<String> ids(JsonNode page) {
        List<String> ids = new ArrayList<>();
        page.get("items").forEach(item -> ids.add(item.get("sourceId").asText()));
        return ids;
    }
}
