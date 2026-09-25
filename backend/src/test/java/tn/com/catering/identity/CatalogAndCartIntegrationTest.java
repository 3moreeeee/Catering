package tn.com.catering.identity;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tn.com.catering.identity.repositories.CartRepository;
import tn.com.catering.identity.repositories.ProductRepository;
import tn.com.catering.identity.repositories.QuoteRepository;

/**
 * End-to-end cover for the catalogue and panier.
 *
 * <p>The catalogue seeder is disabled here so the fixtures are explicit and the
 * assertions do not depend on the 247-row snapshot, which changes whenever the
 * export script is re-run.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:catalog-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=test-only-secret-that-is-longer-than-thirty-two-characters",
        "app.admin.email=admin@fk.test",
        "app.admin.password=AdminPassword123!",
        "app.catalog.seed-on-startup=false"
})
@AutoConfigureMockMvc
class CatalogAndCartIntegrationTest {

    private static final String PRICED_PRODUCT = """
            {
              "sourceId":"fk-1","slug":"bac-gastronorme-gn11",
              "nameFr":"Bac gastronorme inox GN 1/1","categoryId":"food",
              "price":89.500,"currency":"TND","reference":"GN-11-100",
              "images":[{"src":"/img/gn11.webp","altFr":"Bac gastronorme inox GN 1/1"}]
            }
            """;

    private static final String UNPRICED_PRODUCT = """
            {
              "sourceId":"fk-2","slug":"carton-sur-mesure",
              "nameFr":"Carton sur mesure","categoryId":"packaging",
              "images":[{"src":"/img/carton.webp","altFr":"Carton sur mesure"}]
            }
            """;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    QuoteRepository quotes;

    @Autowired
    CartRepository carts;

    @Autowired
    ProductRepository products;

    private Cookie admin;

    /**
     * The whole class shares one Spring context and one in-memory database, so
     * the catalogue is wiped between methods. Without this, a fixture created by
     * one test collides on the unique slug with the next one. Quotes go first
     * because their lines reference products.
     */
    @BeforeEach
    void resetCatalogueAndSignInAdministrator() throws Exception {
        quotes.deleteAll();
        carts.deleteAll();
        products.deleteAll();
        admin = login("admin@fk.test", "AdminPassword123!");
    }

    @Test
    void theCatalogueIsPubliclyReadableButOnlyAnAdministratorMayWriteToIt() throws Exception {
        mvc.perform(get("/api/products")).andExpect(status().isOk());

        mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content(PRICED_PRODUCT))
                .andExpect(status().isUnauthorized());

        Cookie client = register("buyer-a@fk.test");
        mvc.perform(post("/api/products").cookie(client)
                        .contentType(MediaType.APPLICATION_JSON).content(PRICED_PRODUCT))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/products").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(PRICED_PRODUCT))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.price").value(89.500))
                .andExpect(jsonPath("$.currency").value("TND"));

        mvc.perform(get("/api/products/bac-gastronorme-gn11"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name.fr").value("Bac gastronorme inox GN 1/1"));
    }

    @Test
    void aProductWithoutAPriceIsPublishedWithANullPriceRatherThanZero() throws Exception {
        String id = createProduct(UNPRICED_PRODUCT);

        mvc.perform(get("/api/products/carton-sur-mesure"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.price").doesNotExist())
                .andExpect(jsonPath("$.currency").doesNotExist());

        Cookie client = register("buyer-b@fk.test");
        mvc.perform(post("/api/cart/items").cookie(client).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + id + "\",\"quantity\":4}"))
                .andExpect(status().isOk())
                // The unpriced line contributes nothing to the total and is
                // flagged, so the UI can say the total is partial instead of
                // implying the reference is free.
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.hasUnpricedItems").value(true))
                .andExpect(jsonPath("$.items[0].unitPrice").doesNotExist());
    }

    @Test
    void addingTheSameProductTwiceIncreasesTheExistingLine() throws Exception {
        String id = createProduct(PRICED_PRODUCT);
        Cookie client = register("buyer-c@fk.test");

        addToCart(client, id, 2);
        mvc.perform(post("/api/cart/items").cookie(client).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + id + "\",\"quantity\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itemCount").value(1))
                .andExpect(jsonPath("$.items[0].quantity").value(5))
                .andExpect(jsonPath("$.total").value(447.500));
    }

    @Test
    void onePersonsCartAndQuotesAreInvisibleToAnother() throws Exception {
        String id = createProduct(PRICED_PRODUCT);
        Cookie owner = register("owner@fk.test");
        Cookie stranger = register("stranger@fk.test");

        addToCart(owner, id, 2);
        String quoteId = read(mvc.perform(post("/api/cart/submit").cookie(owner)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isCreated())).get("id").asText();

        mvc.perform(get("/api/cart").cookie(stranger))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itemCount").value(0));

        // Someone else's quote reads as absent rather than forbidden, so the
        // endpoint cannot be used to discover which references exist.
        mvc.perform(get("/api/quotes/" + quoteId).cookie(stranger)).andExpect(status().isNotFound());
        mvc.perform(get("/api/quotes/me").cookie(stranger))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/quotes").cookie(stranger)).andExpect(status().isForbidden());

        mvc.perform(get("/api/quotes/" + quoteId).cookie(admin)).andExpect(status().isOk());
    }

    @Test
    void aSubmittedQuoteKeepsThePriceTheBuyerWasShown() throws Exception {
        String id = createProduct(PRICED_PRODUCT);
        Cookie client = register("buyer-d@fk.test");
        addToCart(client, id, 2);

        mvc.perform(post("/api/cart/submit").cookie(client)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deliveryCity\":\"Tunis\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reference").exists())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.totalAmount").value(179.000));

        mvc.perform(patch("/api/products/" + id + "/price").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"price\":150.000,\"currency\":\"TND\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.price").value(150.000));

        mvc.perform(get("/api/quotes/me").cookie(client))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].totalAmount").value(179.000))
                .andExpect(jsonPath("$[0].lines[0].unitPrice").value(89.500));
    }

    @Test
    void submittingRetiresTheCartAndAnEmptyCartIsRefused() throws Exception {
        String id = createProduct(PRICED_PRODUCT);
        Cookie client = register("buyer-e@fk.test");

        mvc.perform(post("/api/cart/submit").cookie(client)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("cart_empty"));

        addToCart(client, id, 1);
        mvc.perform(post("/api/cart/submit").cookie(client)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/cart").cookie(client))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.itemCount").value(0));
    }

    @Test
    void deactivationHidesAProductFromTheCatalogueWithoutDeletingIt() throws Exception {
        String id = createProduct(PRICED_PRODUCT);
        Cookie client = register("buyer-f@fk.test");

        mvc.perform(delete("/api/products/" + id).cookie(admin)).andExpect(status().isNoContent());

        mvc.perform(get("/api/products/bac-gastronorme-gn11")).andExpect(status().isNotFound());
        mvc.perform(post("/api/cart/items").cookie(client).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + id + "\",\"quantity\":1}"))
                .andExpect(status().isNotFound());

        // Still there for the administrator, which is what keeps historical
        // quotes readable.
        mvc.perform(get("/api/products/id/" + id).cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void aDuplicateSlugOrInternalReferenceIsRejected() throws Exception {
        createProduct(PRICED_PRODUCT);

        mvc.perform(post("/api/products").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceId":"fk-99","slug":"bac-gastronorme-gn11",
                                 "nameFr":"Doublon","categoryId":"food"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("product_slug_exists"));

        mvc.perform(post("/api/products").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceId":"fk-1","slug":"autre-slug",
                                 "nameFr":"Doublon","categoryId":"food"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("product_source_id_exists"));
    }

    @Test
    void anAdministratorMovesAQuoteThroughItsLifecycleAndCannotReopenAClosedOne() throws Exception {
        String id = createProduct(PRICED_PRODUCT);
        Cookie client = register("buyer-g@fk.test");
        addToCart(client, id, 1);
        String quoteId = read(mvc.perform(post("/api/cart/submit").cookie(client)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))).get("id").asText();

        mvc.perform(patch("/api/quotes/" + quoteId + "/status").cookie(client)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ANSWERED\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(patch("/api/quotes/" + quoteId + "/status").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CLOSED\",\"adminNote\":\"Offre envoyee.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));

        mvc.perform(patch("/api/quotes/" + quoteId + "/status").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_REVIEW\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("quote_closed"));
    }

    @Test
    void anAdministratorCanUseThePanier() throws Exception {
        String id = createProduct(PRICED_PRODUCT);

        mvc.perform(get("/api/cart").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itemCount").value(0));
        mvc.perform(post("/api/cart/items").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + id + "\",\"quantity\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itemCount").value(1));
    }

    @Test
    void anAdministratorCanPublishAnOfferThatIsUsedByTheCatalogueAndPanier() throws Exception {
        String id = createProduct(PRICED_PRODUCT);

        mvc.perform(put("/api/admin/offers/" + id).cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"offerPrice\":69.900,\"active\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offerCurrentlyActive").value(true));

        mvc.perform(get("/api/products/prices").param("sourceIds", "fk-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].price").value(69.900))
                .andExpect(jsonPath("$[0].originalPrice").value(89.500))
                .andExpect(jsonPath("$[0].offerActive").value(true));

        mvc.perform(post("/api/cart/items").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + id + "\",\"quantity\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].unitPrice").value(69.900))
                .andExpect(jsonPath("$.total").value(139.800));

        mvc.perform(delete("/api/admin/offers/" + id).cookie(admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/admin/offers").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void theBackOfficeListingIncludesDeactivatedProductsAndIsAdminOnly() throws Exception {
        String active = createProduct(PRICED_PRODUCT);
        String unpriced = createProduct(UNPRICED_PRODUCT);
        mvc.perform(delete("/api/products/" + active).cookie(admin)).andExpect(status().isNoContent());

        mvc.perform(get("/api/admin/products").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));
        mvc.perform(get("/api/admin/products").param("status", "inactive").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(active));
        mvc.perform(get("/api/admin/products").param("priced", "no").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(unpriced));

        Cookie client = register("buyer-h@fk.test");
        mvc.perform(get("/api/admin/products").cookie(client)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/products")).andExpect(status().isUnauthorized());
    }

    @Test
    void theOverviewCountsWhatTheSystemHolds() throws Exception {
        String id = createProduct(PRICED_PRODUCT);
        createProduct(UNPRICED_PRODUCT);
        Cookie client = register("buyer-i@fk.test");
        addToCart(client, id, 1);
        mvc.perform(post("/api/cart/submit").cookie(client)
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isCreated());

        mvc.perform(get("/api/admin/stats").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeProducts").value(2))
                .andExpect(jsonPath("$.pricedProducts").value(1))
                .andExpect(jsonPath("$.unpricedActiveProducts").value(1))
                .andExpect(jsonPath("$.quotesSubmitted").value(1))
                .andExpect(jsonPath("$.recentQuotes.length()").value(1));
        mvc.perform(get("/api/admin/stats").cookie(client)).andExpect(status().isForbidden());
    }

    @Test
    void aNegativePriceIsRejected() throws Exception {
        mvc.perform(post("/api/products").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceId":"fk-neg","slug":"prix-negatif",
                                 "nameFr":"Prix negatif","categoryId":"food","price":-1.000}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fields.price").exists());
    }

    // -------------------------------------------------------------------------

    private String createProduct(String body) throws Exception {
        return read(mvc.perform(post("/api/products").cookie(admin)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())).get("id").asText();
    }

    private void addToCart(Cookie who, String productId, int quantity) throws Exception {
        mvc.perform(post("/api/cart/items").cookie(who).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + productId + "\",\"quantity\":" + quantity + "}"))
                .andExpect(status().isOk());
    }

    private Cookie register(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"clientType":"PHYSIQUE","firstName":"Test","lastName":"Buyer",
                                 "email":"%s","password":"StrongPassword123!"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return result.getResponse().getCookie("FK_SESSION");
    }

    private Cookie login(String email, String password) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getCookie("FK_SESSION");
    }

    private JsonNode read(org.springframework.test.web.servlet.ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }
}
