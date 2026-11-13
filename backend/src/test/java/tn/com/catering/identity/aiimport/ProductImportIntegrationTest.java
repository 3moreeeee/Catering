package tn.com.catering.identity.aiimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tn.com.catering.identity.DTO.MediaUploadResponse;
import tn.com.catering.identity.entities.Brand;
import tn.com.catering.identity.entities.Category;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.repositories.BrandRepository;
import tn.com.catering.identity.repositories.CartRepository;
import tn.com.catering.identity.repositories.CategoryRepository;
import tn.com.catering.identity.repositories.ProductRepository;
import tn.com.catering.identity.repositories.QuoteRepository;
import tn.com.catering.identity.services.ImageKitUploadService;

/**
 * The importer end to end, with ImageKit and the model replaced by mocks:
 * upload, background processing, price-gated publication, duplicate detection
 * and the failure path.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:ai-import-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=test-only-secret-that-is-longer-than-thirty-two-characters",
        "app.admin.email=admin@fk.test",
        "app.admin.password=AdminPassword123!",
        "app.catalog.seed-on-startup=false",
        "app.catalog.reconcile-on-startup=false",
        "app.ai.base-url=https://ai.test/v1",
        "app.ai.api-key=test-key",
        "app.ai.model=test-vision-model",
        "app.ai.requests-per-minute=6000"
})
@AutoConfigureMockMvc
class ProductImportIntegrationTest {

    private static final String UPLOADED = "https://ik.imagekit.io/test/fk-catering/img/products/ai-import/sirop.png";

    private static final String STRAWBERRY = """
            ```json
            {"nameFr":"Sirop de fraise MONIN 70cl","nameEn":"MONIN Strawberry Syrup 70cl",
             "shortDescriptionFr":"Sirop pour boissons et cocktails.","shortDescriptionEn":"Syrup for drinks.",
             "descriptionFr":"Sirop de fraise pour les bars.","descriptionEn":"Strawberry syrup for bars.",
             "categoryId":"monin","subcategoryId":"monin-syrups","brandId":"MONIN",
             "industries":["restaurants","hotels","unknown-sector"],
             "format":"70 cl","packQuantity":null,"unitLabel":"bouteille"}
            ```
            """;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ProductImportItemRepository items;
    @Autowired ProductRepository products;
    @Autowired CategoryRepository categories;
    @Autowired BrandRepository brands;
    @Autowired QuoteRepository quotes;
    @Autowired CartRepository carts;

    @MockitoBean ImageKitUploadService media;
    @MockitoBean ProductVisionClient vision;

    private Cookie admin;

    @Autowired PriceListRowRepository priceRows;
    @Autowired org.springframework.transaction.support.TransactionTemplate tx;

    @BeforeEach
    void reset() throws Exception {
        items.deleteAll();
        priceRows.deleteAll();
        quotes.deleteAll();
        carts.deleteAll();
        products.deleteAll();
        categories.deleteAll();
        brands.deleteAll();
        categories.save(new Category("monin", "monin", "MONIN"));
        Category syrups = new Category("monin-syrups", "sirops", "Sirops");
        syrups.setParentExternalId("monin");
        categories.save(syrups);
        categories.save(new Category("hygiene", "hygiene", "Hygiène"));
        brands.save(new Brand("monin", "monin", "Monin"));
        when(media.uploadProductImage(any(), eq(ProductImportService.IMAGE_FOLDER)))
                .thenReturn(new MediaUploadResponse(UPLOADED, 800, 1000));
        admin = login();
    }

    @Test
    void anImageBecomesAReviewableDraftAndIsPublishedOnlyWithAPrice() throws Exception {
        when(vision.describe(anyString(), anyString(), anyString())).thenReturn(STRAWBERRY);

        JsonNode queued = upload("Sirop fraise MONIN 70cl.png");
        assertThat(queued.path("status").asText()).isIn("QUEUED", "PROCESSING", "READY");
        String id = queued.path("id").asText();

        JsonNode ready = awaitStatus(id, "READY");
        assertThat(ready.path("action").asText()).isEqualTo("CREATE");
        assertThat(ready.path("nameFr").asText()).isEqualTo("Sirop de fraise MONIN 70cl");
        assertThat(ready.path("brandId").asText()).isEqualTo("monin");
        assertThat(ready.path("subcategoryId").asText()).isEqualTo("monin-syrups");
        assertThat(ready.path("industries").toString()).isEqualTo("[\"restaurants\",\"hotels\"]");
        assertThat(ready.path("displayUrl").asText()).isEqualTo(UPLOADED + "?tr=e-bgremove");
        verify(vision).describe(anyString(), eq("Nom du fichier : « Sirop fraise MONIN 70cl.png ». Rédige la fiche produit en JSON."), eq(UPLOADED));
        assertThat(products.count()).isZero();

        mvc.perform(post("/api/admin/imports/" + id + "/publish").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"saleMode\":\"UNIT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("import_price_required"));
        assertThat(products.count()).isZero();

        mvc.perform(post("/api/admin/imports/" + id + "/publish").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"saleMode\":\"UNIT\",\"price\":25.500}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        mvc.perform(get("/api/products/sirop-de-fraise-monin-70cl"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.price").value(25.5))
                .andExpect(jsonPath("$.images[0].src").value(UPLOADED + "?tr=e-bgremove"));
    }

    @Test
    void aPhotographOfAnExistingProductProposesReplacingItsImage() throws Exception {
        Product existing = new Product("p-monin-1", "sirop-de-fraise-monin-70cl", "Sirop de fraise MONIN 70cl", "monin");
        existing.addImage(new tn.com.catering.identity.entities.ProductImage("/img/old.png", "old", null, 10, 10, 0));
        existing = products.save(existing);
        when(vision.describe(anyString(), anyString(), anyString())).thenReturn(STRAWBERRY);

        String id = upload("sirop FRAISE monin 70 cl.jpg").path("id").asText();
        JsonNode ready = awaitStatus(id, "READY");
        assertThat(ready.path("action").asText()).isEqualTo("REPLACE_IMAGE");
        assertThat(ready.path("matchedProductId").asText()).isEqualTo(existing.getId().toString());

        mvc.perform(post("/api/admin/imports/" + id + "/publish").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());

        assertThat(products.count()).isEqualTo(1);
        mvc.perform(get("/api/products/sirop-de-fraise-monin-70cl"))
                .andExpect(jsonPath("$.images.length()").value(1))
                .andExpect(jsonPath("$.images[0].src").value(UPLOADED + "?tr=e-bgremove"));
    }

    /** The real case: the client's "Champignons en tranches" file is a photo of sweet corn. */
    @Test
    void aFileNameThatContradictsTheLabelIsFlaggedAndNeverReplacesTheWrongProduct() throws Exception {
        products.save(new Product("p-emp-1", "champignons-en-tranches-emporium-850g",
                "Champignons en tranches Emporium 850g", "monin"));
        when(vision.describe(anyString(), anyString(), anyString())).thenReturn(
                "{\"nameFr\":\"Maïs doux Emporium 850g\",\"categoryId\":\"monin\",\"format\":\"850 g\","
                        + "\"fileNameMatches\":false}");

        String id = upload("Champignons en tranches Emporium 850g.png").path("id").asText();
        JsonNode ready = awaitStatus(id, "READY");

        assertThat(ready.path("action").asText()).isEqualTo("CREATE");
        assertThat(ready.path("matchedProductId").isNull()).isTrue();
        assertThat(ready.path("warning").asText())
                .contains("Champignons en tranches Emporium 850g")
                .contains("Maïs doux Emporium 850g");
    }

    /** The whole chain: a price list is loaded, a photograph finds its row, the owner publishes the lot price. */
    @Test
    void thePriceComesFromTheLoadedPriceListInLots() throws Exception {
        MockMultipartFile pdf = new MockMultipartFile("files", "Liste des Couverts jetables 08 2022.pdf",
                "application/pdf", priceListPdf("FOURCHETTE EN BOIS", "0,090", "CARTON DE 1000 PCS",
                        "COUTEAU EN BOIS", "0,085", "CARTON DE 1000 PCS"));
        mvc.perform(multipart("/api/admin/imports/price-lists").file(pdf).cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].listName").value("Liste des Couverts jetables"))
                .andExpect(jsonPath("$[0].rows").value(2));

        when(vision.describe(anyString(), anyString(), anyString())).thenReturn(
                "{\"nameFr\":\"Fourchette en bois - Les 100 pièces\",\"categoryId\":\"monin\",\"packQuantity\":100}");
        when(vision.ask(anyString(), anyString())).thenReturn(
                "{\"choice\": 1, \"priceFor\": \"piece\", \"unitLabel\": \"piece\", \"reason\": \"même article\"}");

        String id = upload("FOURCHETTE BOIS DE 100.png").path("id").asText();
        JsonNode ready = awaitStatus(id, "READY");
        assertThat(ready.path("suggestedSaleMode").asText()).isEqualTo("PACK_ONLY");
        assertThat(ready.path("suggestedPrice").decimalValue()).isEqualByComparingTo("0.090");
        assertThat(ready.path("packQuantity").asInt()).isEqualTo(100);
        assertThat(ready.path("priceSource").asText()).contains("FOURCHETTE EN BOIS").contains("0,090");
        verify(vision).ask(anyString(), org.mockito.ArgumentMatchers.contains("COUTEAU EN BOIS"));

        mvc.perform(post("/api/admin/imports/" + id + "/publish").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"saleMode\":\"PACK_ONLY\",\"unitPrice\":0.090}"))
                .andExpect(status().isOk());
        tx.executeWithoutResult(status -> assertThat(products.findAll()).singleElement().satisfies(product -> {
            assertThat(product.getPrice()).isEqualByComparingTo("9.000");
            assertThat(product.getPackQuantity()).isEqualTo(100);
        }));
    }

    /** A one-page price list laid out like the company's: name, price, packaging. */
    private static byte[] priceListPdf(String... cells) throws Exception {
        try (org.apache.pdfbox.pdmodel.PDDocument document = new org.apache.pdfbox.pdmodel.PDDocument()) {
            org.apache.pdfbox.pdmodel.PDPage page = new org.apache.pdfbox.pdmodel.PDPage();
            document.addPage(page);
            org.apache.pdfbox.pdmodel.font.PDType1Font font = org.apache.pdfbox.pdmodel.font.PDType1Font.HELVETICA;
            try (org.apache.pdfbox.pdmodel.PDPageContentStream content =
                         new org.apache.pdfbox.pdmodel.PDPageContentStream(document, page)) {
                float y = 700;
                for (int index = 0; index < cells.length; index += 3) {
                    float[] columns = {40, 300, 380};
                    for (int column = 0; column < 3; column++) {
                        content.beginText();
                        content.setFont(font, 10);
                        content.newLineAtOffset(columns[column], y);
                        content.showText(cells[index + column]);
                        content.endText();
                    }
                    y -= 40;
                }
            }
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void anUnusableAnswerIsRetriedThenMarkedFailed() throws Exception {
        when(vision.describe(anyString(), anyString(), anyString()))
                .thenReturn("{\"nameFr\":\"Produit\",\"categoryId\":\"invented-division\"}");

        String id = upload("mystere.png").path("id").asText();
        JsonNode failed = awaitStatus(id, "FAILED");
        assertThat(failed.path("attempts").asInt()).isEqualTo(ProductImportWorker.MAX_ATTEMPTS);
        assertThat(failed.path("error").asText()).contains("invented-division");

        mvc.perform(post("/api/admin/imports/" + id + "/publish").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"price\":1}"))
                .andExpect(status().isConflict());
    }

    @Test
    void theImporterIsAdminOnly() throws Exception {
        mvc.perform(get("/api/admin/imports")).andExpect(status().is4xxClientError());
        mvc.perform(get("/api/admin/imports").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.model").value("test-vision-model"));
        verify(vision, never()).describe(anyString(), anyString(), anyString());
    }

    @Test
    void anUploadWithoutAFileIsABadRequest() throws Exception {
        mvc.perform(multipart("/api/admin/imports").cookie(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("image_required"));
    }

    // -------------------------------------------------------------------------

    private JsonNode upload(String filename) throws Exception {
        MockMultipartFile file = new MockMultipartFile("files", filename, "image/png", new byte[] {1, 2, 3});
        String body = mvc.perform(multipart("/api/admin/imports").file(file).cookie(admin))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get(0);
    }

    private JsonNode awaitStatus(String id, String wanted) throws Exception {
        long deadline = System.currentTimeMillis() + 15_000;
        JsonNode last = null;
        while (System.currentTimeMillis() < deadline) {
            String body = mvc.perform(get("/api/admin/imports").param("status", "ALL").cookie(admin))
                    .andReturn().getResponse().getContentAsString();
            for (JsonNode item : json.readTree(body).path("items")) {
                if (item.path("id").asText().equals(id)) last = item;
            }
            if (last != null && last.path("status").asText().equals(wanted)) return last;
            Thread.sleep(100);
        }
        throw new AssertionError("Item " + id + " never reached " + wanted + "; last seen: " + last);
    }

    private Cookie login() throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@fk.test\",\"password\":\"AdminPassword123!\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("FK_SESSION");
    }
}
