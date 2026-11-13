package tn.com.catering.identity.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import tn.com.catering.identity.entities.Category;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.repositories.CategoryRepository;
import tn.com.catering.identity.repositories.ProductRepository;

/** The category tree follows catalog/taxonomy.json: three levels, Vinto's order, filters that cover sub-levels. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:taxonomy-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=test-only-secret-that-is-longer-than-thirty-two-characters",
        "app.catalog.seed-on-startup=true",
        "app.catalog.reconcile-on-startup=false"
})
@AutoConfigureMockMvc
class TaxonomySynchronizerIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired CategoryRepository categories;
    @Autowired ProductRepository products;
    @Autowired TaxonomySynchronizer synchronizer;
    @Autowired TransactionTemplate tx;

    @Test
    void theDatabaseHoldsExactlyTheTaxonomyFile() throws Exception {
        List<String> ids = synchronizer.ids();
        assertThat(categories.findAll()).extracting(Category::getExternalId)
                .containsExactlyInAnyOrderElementsOf(ids);
        // The seed's old categories are gone, and the MONIN syrups id is no longer shared.
        assertThat(categories.findByExternalId("trays-containers")).isEmpty();
        assertThat(categories.findByExternalId("syrups")).get()
                .extracting(Category::getParentExternalId).isEqualTo("monin");
    }

    @Test
    void theApiListsThreeLevelsInVintoOrder() throws Exception {
        mvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].externalId").value(org.hamcrest.Matchers.contains(
                        "food", "packaging", "monin", "hygiene")))
                .andExpect(jsonPath("$[1].subcategories.length()").value(7))
                .andExpect(jsonPath("$[1].subcategories[1].externalId").value("cups-glasses"))
                .andExpect(jsonPath("$[1].subcategories[1].subcategories[*].externalId").value(
                        org.hamcrest.Matchers.contains("pet-cups", "paper-cups", "eps-cups", "glassware")))
                .andExpect(jsonPath("$[2].subcategories[0].subcategories.length()").value(0));
    }

    @Test
    void runningAgainChangesNothingAndRemovesStrayCategories() throws Exception {
        long before = categories.count();
        tx.executeWithoutResult(status -> categories.save(new Category("stray", "stray", "Ancienne catégorie")));
        tx.executeWithoutResult(status -> {
            try {
                synchronizer.synchronize();
            } catch (java.io.IOException error) {
                throw new IllegalStateException(error);
            }
        });
        assertThat(categories.count()).isEqualTo(before);
        assertThat(categories.findByExternalId("stray")).isEmpty();
    }

    @Test
    void aCategoryFilterIncludesItsSubCategories() throws Exception {
        Product cup = new Product("p-test-pet-cup", "gobelet-pet-test", "Gobelet PET test", "packaging");
        cup.setSubcategoryId("pet-cups");
        cup.setPrice(new java.math.BigDecimal("3.000"));
        cup.setCurrency("TND");
        products.save(cup);
        try {
            mvc.perform(get("/api/products").param("subcategory", "cups-glasses").param("q", "Gobelet PET test"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[*].slug").value(org.hamcrest.Matchers.hasItem("gobelet-pet-test")));
            mvc.perform(get("/api/products").param("subcategory", "straws").param("q", "Gobelet PET test"))
                    .andExpect(jsonPath("$.items[*].slug").value(
                            org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("gobelet-pet-test"))));
        } finally {
            products.delete(products.findBySourceId("p-test-pet-cup").orElseThrow());
        }
    }
}
