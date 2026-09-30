package tn.com.catering.identity;

import static org.hamcrest.Matchers.is;
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
import org.springframework.test.web.servlet.ResultActions;
import tn.com.catering.identity.repositories.CartRepository;
import tn.com.catering.identity.repositories.ProductRepository;
import tn.com.catering.identity.repositories.QuoteRepository;

/**
 * Pack-only sale end to end: admin creation and edition, the derived pack price,
 * validation, the panier counting packs and the quote freezing the pack terms.
 *
 * <p>Amounts are asserted on the raw JSON text as well as by value, because the
 * point is three exact decimals ("12.000"), not a number equal to twelve.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:pack-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=test-only-secret-that-is-longer-than-thirty-two-characters",
        "app.admin.email=admin@fk.test",
        "app.admin.password=AdminPassword123!",
        "app.catalog.seed-on-startup=false"
})
@AutoConfigureMockMvc
class PackPricingIntegrationTest {

    /** The acceptance case: 0.120 TND a cap, sold by 100. {@code price} is deliberately wrong. */
    private static final String BONNET = """
            {
              "sourceId":"p-bonnet-de-douche","slug":"bonnet-de-douche",
              "nameFr":"Bonnet de douche","categoryId":"hygiene",
              "saleMode":"PACK_ONLY","unitPrice":0.120,"packQuantity":100,"unitLabel":"piece",
              "price":15.000
            }
            """;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired QuoteRepository quotes;
    @Autowired CartRepository carts;
    @Autowired ProductRepository products;

    private Cookie admin;

    @BeforeEach
    void reset() throws Exception {
        quotes.deleteAll();
        carts.deleteAll();
        products.deleteAll();
        admin = login();
    }

    @Test
    void theServerDerivesThePackPriceAndIgnoresAnySubmittedPrice() throws Exception {
        ResultActions created = mvc.perform(post("/api/products").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(BONNET))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.saleMode").value("PACK_ONLY"))
                .andExpect(jsonPath("$.unitPrice").value(0.120))
                .andExpect(jsonPath("$.packQuantity").value(100))
                .andExpect(jsonPath("$.unitLabel").value("piece"))
                .andExpect(jsonPath("$.packPrice").value(12.000))
                .andExpect(jsonPath("$.price").value(12.000))
                .andExpect(jsonPath("$.formats[0].packQuantity").value(100))
                .andExpect(jsonPath("$.formats[0].value").value("Pack de 100"));
        String body = created.andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(body).contains("\"packPrice\":12.000").contains("\"unitPrice\":0.120");

        mvc.perform(get("/api/products/prices").param("sourceIds", "p-bonnet-de-douche"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].saleMode").value("PACK_ONLY"))
                .andExpect(jsonPath("$[0].price").value(12.000))
                .andExpect(jsonPath("$[0].unitPrice").value(0.120))
                .andExpect(jsonPath("$[0].packQuantity").value(100));
    }

    @Test
    void editingThePackSizeRecomputesThePackPrice() throws Exception {
        String id = create(BONNET);
        mvc.perform(put("/api/products/" + id).cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(BONNET.replace("\"packQuantity\":100", "\"packQuantity\":200")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.packPrice").value(24.000))
                .andExpect(jsonPath("$.price").value(24.000))
                .andExpect(jsonPath("$.formats[0].value").value("Pack de 200"));

        mvc.perform(put("/api/products/" + id).cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(BONNET.replace("\"unitPrice\":0.120", "\"unitPrice\":0.333")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.packPrice").value(33.300));
    }

    @Test
    void aPhysicalFormatIsKeptWhenThePackSizeIsSet() throws Exception {
        String syrup = """
                {"sourceId":"p-sirop","slug":"sirop","nameFr":"Sirop 70cl","categoryId":"monin",
                 "saleMode":"PACK_ONLY","unitPrice":27.406,"packQuantity":6,"unitLabel":"bouteille",
                 "formats":[{"value":"70 cl"}]}
                """;
        mvc.perform(post("/api/products").cookie(admin).contentType(MediaType.APPLICATION_JSON).content(syrup))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.formats[0].value").value("70 cl"))
                .andExpect(jsonPath("$.formats[0].packQuantity").value(6))
                .andExpect(jsonPath("$.packPrice").value(164.436));
    }

    @Test
    void invalidPackTermsAreRejected() throws Exception {
        expectRejected(BONNET.replace("\"unitPrice\":0.120", "\"unitPrice\":-0.120"), "validation_failed");
        expectRejected(BONNET.replace("\"unitPrice\":0.120", "\"unitPrice\":0"), "validation_failed");
        expectRejected(BONNET.replace("\"unitPrice\":0.120", "\"unitPrice\":0.1205"), "validation_failed");
        expectRejected(BONNET.replace("\"packQuantity\":100", "\"packQuantity\":0"), "validation_failed");
        expectRejected(BONNET.replace("\"packQuantity\":100", "\"packQuantity\":-5"), "validation_failed");
        expectRejected(BONNET.replace("\"unitLabel\":\"piece\"", "\"unitLabel\":\"<script>\""), "validation_failed");
        expectRejected(BONNET.replace("\"unitPrice\":0.120,", ""), "pack_unit_price_required");
        expectRejected(BONNET.replace("\"packQuantity\":100,", ""), "pack_quantity_required");
        // 100.5 pieces is not a pack size: Jackson must not truncate it to 100.
        mvc.perform(post("/api/products").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(BONNET.replace("\"packQuantity\":100", "\"packQuantity\":100.5")))
                .andExpect(status().isBadRequest());
        org.assertj.core.api.Assertions.assertThat(products.count()).isZero();
    }

    @Test
    void theDerivedPackPriceCannotBeOverwrittenFromThePriceList() throws Exception {
        String id = create(BONNET);
        mvc.perform(patch("/api/products/" + id + "/price").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"price\":15.000,\"currency\":\"TND\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("pack_price_derived"));
        // Re-sending the same price (12 or 12.000) with a stock change is fine.
        mvc.perform(patch("/api/products/" + id + "/price").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"price\":12,\"currency\":\"TND\",\"stockQuantity\":40}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(40));
    }

    @Test
    void thePanierCountsPacksAndTheServerPricesThem() throws Exception {
        String id = create(BONNET);
        Cookie buyer = register("pack-buyer@fk.test");

        cart(buyer, id, 1)
                .andExpect(jsonPath("$.items[0].quantity").value(1))
                .andExpect(jsonPath("$.items[0].saleMode").value("PACK_ONLY"))
                .andExpect(jsonPath("$.items[0].packQuantity").value(100))
                .andExpect(jsonPath("$.items[0].piecePrice").value(0.120))
                .andExpect(jsonPath("$.items[0].unitPrice").value(12.000))
                .andExpect(jsonPath("$.items[0].totalPieces").value(100))
                .andExpect(jsonPath("$.items[0].lineTotal").value(12.000))
                .andExpect(jsonPath("$.total").value(12.000));

        String itemId = read(mvc.perform(get("/api/cart").cookie(buyer))).at("/items/0/id").asText();
        for (int[] packs : new int[][] {{2, 200}, {5, 500}}) {
            mvc.perform(put("/api/cart/items/" + itemId).cookie(buyer).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"quantity\":" + packs[0] + "}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[0].totalPieces").value(packs[1]))
                    .andExpect(jsonPath("$.items[0].lineTotal").value(12.000 * packs[0]))
                    .andExpect(jsonPath("$.total").value(12.000 * packs[0]));
        }
        String cartJson = mvc.perform(get("/api/cart").cookie(buyer)).andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(cartJson).contains("\"lineTotal\":60.000");

        // A fractional pack count is refused, not rounded.
        mvc.perform(put("/api/cart/items/" + itemId).cookie(buyer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":1.5}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aSubmittedQuoteFreezesThePackTerms() throws Exception {
        String id = create(BONNET);
        Cookie buyer = register("pack-quote@fk.test");
        cart(buyer, id, 2);

        mvc.perform(post("/api/cart/submit").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"ORDER\",\"contactPhone\":\"22000000\",\"deliveryCity\":\"Sfax\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalAmount").value(24.000))
                .andExpect(jsonPath("$.lines[0].quantity").value(2))
                .andExpect(jsonPath("$.lines[0].packQuantity").value(100))
                .andExpect(jsonPath("$.lines[0].totalPieces").value(200))
                .andExpect(jsonPath("$.lines[0].piecePrice").value(0.120))
                .andExpect(jsonPath("$.lines[0].unitPrice").value(12.000))
                .andExpect(jsonPath("$.lines[0].lineTotal").value(24.000));

        // Repricing afterwards leaves the submitted document untouched.
        mvc.perform(put("/api/products/" + id).cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(BONNET.replace("\"packQuantity\":100", "\"packQuantity\":50")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/quotes/me").cookie(buyer))
                .andExpect(jsonPath("$[0].lines[0].packQuantity").value(100))
                .andExpect(jsonPath("$[0].lines[0].lineTotal").value(24.000));
    }

    @Test
    void aUnitProductIsUnchanged() throws Exception {
        String id = create("""
                {"sourceId":"p-unit","slug":"unit","nameFr":"Dentelle LES 250","categoryId":"packaging",
                 "price":5.800,"formats":[{"value":"114 mm","packQuantity":250}]}
                """);
        mvc.perform(get("/api/products/unit"))
                .andExpect(jsonPath("$.saleMode").value("UNIT"))
                .andExpect(jsonPath("$.price").value(5.800))
                .andExpect(jsonPath("$.packQuantity").value(250))
                .andExpect(jsonPath("$.unitPrice").doesNotExist())
                .andExpect(jsonPath("$.packPrice").doesNotExist());
        Cookie buyer = register("unit-buyer@fk.test");
        cart(buyer, id, 3)
                .andExpect(jsonPath("$.total").value(17.400))
                .andExpect(jsonPath("$.items[0].totalPieces").doesNotExist())
                .andExpect(jsonPath("$.items[0].saleMode", is("UNIT")));
    }

    // -------------------------------------------------------------------------

    /** Bean-validation failures answer 422; the service's own pack rules answer 400. */
    private void expectRejected(String body, String code) throws Exception {
        mvc.perform(post("/api/products").cookie(admin).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(code.equals("validation_failed") ? status().isUnprocessableEntity() : status().isBadRequest())
                .andExpect(jsonPath("$.code").value(code));
    }

    private String create(String body) throws Exception {
        return read(mvc.perform(post("/api/products").cookie(admin)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())).get("id").asText();
    }

    private ResultActions cart(Cookie who, String productId, int packs) throws Exception {
        return mvc.perform(post("/api/cart/items").cookie(who).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"" + productId + "\",\"quantity\":" + packs + "}"))
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

    private Cookie login() throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@fk.test\",\"password\":\"AdminPassword123!\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("FK_SESSION");
    }

    private JsonNode read(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }
}
