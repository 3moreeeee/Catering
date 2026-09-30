package tn.com.catering.identity.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.entities.SaleMode;
import tn.com.catering.identity.repositories.ProductRepository;

/**
 * Runs the real seed and the real reconciliation batch against H2.
 *
 * <p>The context starts the way a fresh deployment does: the seeder loads the
 * already-reconciled seed and the runner recognises the batch as applied. Each
 * test then rewinds the table to the state production is in (the 247-product
 * catalogue the batch was prepared against) and applies the batch to it.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:reconciliation-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=test-only-secret-that-is-longer-than-thirty-two-characters"
})
@Transactional
class CatalogReconciliationRunnerTest {

    @Autowired
    CatalogReconciliationRunner runner;

    @Autowired
    ProductRepository products;

    @Autowired
    ObjectMapper objectMapper;

    CatalogReconciliationRunner.Batch batch;

    @BeforeEach
    void readBatch() throws Exception {
        try (InputStream in = new ClassPathResource("seed/catalog-reconciliation.json").getInputStream()) {
            batch = objectMapper.readValue(in, CatalogReconciliationRunner.Batch.class);
        }
    }

    @Test
    void aFreshDatabaseStartsFromTheReconciledSeed() {
        assertThat(products.count()).isEqualTo(295);
        assertThat(products.countByActiveTrue()).isEqualTo(295);
        assertThat(products.existsBySourceId("p-vinto-488")).isFalse();
        assertThat(products.findBySourceId("p-vinto-186").orElseThrow().getNameFr())
                .isEqualTo("Verrine rond-carrée 60ml- LES 60 PIÈCES");
        assertThat(runner.apply(batch)).isEqualTo(CatalogReconciliationRunner.Outcome.ALREADY_APPLIED);
    }

    @Test
    void bringsTheProductionCatalogueUpToDateOnce() {
        rewindToPreReconciliationState();
        assertThat(products.countByActiveTrue()).isEqualTo(247);
        BigDecimal priceBefore = products.findBySourceId("p-vinto-373").orElseThrow().getPrice();

        assertThat(runner.apply(batch)).isEqualTo(CatalogReconciliationRunner.Outcome.APPLIED);

        assertThat(products.countByActiveTrue()).isEqualTo(295);
        // Withdrawn products are deactivated, never deleted.
        Product withdrawn = products.findBySourceId("p-vinto-488").orElseThrow();
        assertThat(withdrawn.isActive()).isFalse();
        // Corrections change identity and format, not the commercial fields.
        Product soupBowl = products.findBySourceId("p-vinto-373").orElseThrow();
        assertThat(soupBowl.getNameFr()).isEqualTo("Bol à soupe avec couvercle en carton blanc 1100ml - LES 25 BOITES");
        assertThat(soupBowl.getFormats()).extracting("formatValue").containsExactly("1100 ml");
        // Repriced from the supplier list: 1,350 HT a bowl, the site's lot of 25.
        assertThat(priceBefore).isEqualByComparingTo("46.000");
        assertThat(soupBowl.getUnitPrice()).isEqualByComparingTo("1.350");
        assertThat(soupBowl.getPrice()).isEqualByComparingTo("33.750");
        assertThat(soupBowl.getImages().get(0).getAltFr()).contains("1100ml");
        // Colour identity comes back from the supplier reference.
        assertThat(products.findBySourceId("p-vinto-56").orElseThrow().getFormats())
                .extracting("formatReference").containsExactly("P/PCG-11-R");
        // Additions are priced from the supplier list too, by its colisage.
        assertThat(products.findBySourceId("p-monin-307").orElseThrow().getPrice()).isNotNull();
        assertThat(products.findBySourceId("p-fk-monin-orange-70cl").orElseThrow().getPrice()).isEqualByComparingTo("177.000");
        // A line the list marks "Rupture provisoire" has no price to publish.
        assertThat(products.findBySourceId("p-fk-combinaison").orElseThrow().getPrice()).isNull();
        assertThat(products.findBySourceId("p-fk-combinaison").orElseThrow().getStockQuantity()).isZero();
        // Supplier terms: Grenadine 70cl at 27,406 HT, sold by the carton of 6.
        Product grenadine = products.findBySourceId("p-monin-320").orElseThrow();
        assertThat(grenadine.getSaleMode()).isEqualTo(SaleMode.PACK_ONLY);
        assertThat(grenadine.getUnitPrice()).isEqualByComparingTo("27.406");
        assertThat(grenadine.getPackQuantity()).isEqualTo(6);
        assertThat(grenadine.getPrice()).isEqualByComparingTo("164.436");
        assertThat(grenadine.getFormats()).extracting("formatValue").containsExactly("70 cl");
        // A lot the site already sold is kept: dentelle Ø114 by 250 at 0,017.
        Product dentelle = products.findBySourceId("p-vinto-109").orElseThrow();
        assertThat(dentelle.getPackQuantity()).isEqualTo(250);
        assertThat(dentelle.getPrice()).isEqualByComparingTo("4.250");
        assertThat(products.findBySourceId("p-fk-bonnet-de-douche").orElseThrow().getPrice()).isEqualByComparingTo("12.000");

        // A restart must not repeat the batch, nor overrule an administrator
        // who reactivates a withdrawn product afterwards.
        withdrawn.setActive(true);
        assertThat(runner.apply(batch)).isEqualTo(CatalogReconciliationRunner.Outcome.ALREADY_APPLIED);
        assertThat(products.findBySourceId("p-vinto-488").orElseThrow().isActive()).isTrue();
    }

    @Test
    void leavesRecordsAnAdministratorRenamedUntouched() {
        rewindToPreReconciliationState();
        products.findBySourceId("p-vinto-186").orElseThrow().setNameFr("Verrine renommée par l'administrateur");
        products.findBySourceId("p-vinto-488").orElseThrow().setNameFr("Maïs renommé par l'administrateur");
        products.findBySourceId("p-monin-164").orElseThrow().setPrice(new java.math.BigDecimal("31.000"));

        assertThat(runner.apply(batch)).isEqualTo(CatalogReconciliationRunner.Outcome.APPLIED);

        // A price the administrator set after the batch was prepared is kept.
        assertThat(products.findBySourceId("p-monin-164").orElseThrow().getPrice()).isEqualByComparingTo("31.000");
        assertThat(products.findBySourceId("p-monin-164").orElseThrow().getSaleMode()).isEqualTo(SaleMode.UNIT);

        assertThat(products.findBySourceId("p-vinto-186").orElseThrow().getNameFr())
                .isEqualTo("Verrine renommée par l'administrateur");
        assertThat(products.findBySourceId("p-vinto-488").orElseThrow().isActive()).isTrue();
    }

    /** Recreates what Neon holds today: no additions, old names, withdrawn products still active. */
    private void rewindToPreReconciliationState() {
        List<String> added = batch.additions().stream().map(CatalogSeeder.SeedProduct::sourceId).toList();
        products.deleteAll(products.findBySourceIdIn(added));
        for (CatalogReconciliationRunner.Correction correction : batch.corrections()) {
            products.findBySourceId(correction.sourceId()).orElseThrow().setNameFr(correction.expectedNameFr());
        }
        for (CatalogReconciliationRunner.Deactivation deactivation : batch.deactivations()) {
            products.save(new Product(deactivation.sourceId(), "old-" + deactivation.sourceId(),
                    deactivation.expectedNameFr(), "packaging"));
        }
        rewindPrices();
        products.flush();
    }

    /** The prices every product had before the supplier terms: Vinto's, or none. */
    private void rewindPrices() {
        for (CatalogReconciliationRunner.Repricing repricing : batch.repricings()) {
            products.findBySourceId(repricing.sourceId()).ifPresent(product -> {
                product.setPrice(repricing.expectedPrice());
                product.setSaleMode(SaleMode.UNIT);
                product.setUnitPrice(null);
            });
        }
    }

    @Test
    void aDatabaseWhoseStructureAlreadyChangedStillReceivesTheSupplierTerms() {
        // Production today: additions and corrections in place, prices still
        // Vinto's (or none), and photographs that differ from the matched ones.
        rewindPrices();
        Product bonnet = products.findBySourceId("p-fk-bonnet-de-douche").orElseThrow();
        bonnet.clearImages();
        bonnet.addImage(new tn.com.catering.identity.entities.ProductImage(
                "/img/products/catalogue/bonnet.v2.webp", "Bonnet", null, 800, 800, 0));
        Product tablier = products.findBySourceId("p-fk-tablier-polyethylene").orElseThrow();
        tablier.clearImages();
        tablier.addImage(new tn.com.catering.identity.entities.ProductImage(
                "https://ik.imagekit.io/owner/tablier.webp", "Tablier", null, 800, 800, 0));
        // A new product Neon holds without its matched photograph.
        products.findBySourceId("p-fk-monin-melon-70cl").orElseThrow().clearImages();
        // A format correction added after the first run: the name is unchanged.
        Product sushi = products.findBySourceId("p-vinto-483").orElseThrow();
        sushi.clearFormats();
        sushi.addFormat(new tn.com.catering.identity.entities.ProductFormat("p-vinto-483-f1", "30 mm", 100, null, null, 0));
        products.flush();

        assertThat(runner.apply(batch)).isEqualTo(CatalogReconciliationRunner.Outcome.APPLIED);

        assertThat(products.findBySourceId("p-monin-320").orElseThrow().getPrice()).isEqualByComparingTo("164.436");
        assertThat(products.findBySourceId("p-fk-bonnet-de-douche").orElseThrow().getPrice()).isEqualByComparingTo("12.000");
        assertThat(products.findBySourceId("p-monin-268").orElseThrow().getPrice()).isEqualByComparingTo("208.000");
        assertThat(products.findBySourceId("p-vinto-483").orElseThrow().getFormats())
                .extracting("formatValue").containsExactly("170 × 122 × 30 mm");
        // A stray catalogue image gives way to the photograph declared for the
        // product (here the owner's upload); a matched one gets its photograph;
        // one the owner uploaded stays.
        assertThat(products.findBySourceId("p-fk-bonnet-de-douche").orElseThrow().getImages())
                .extracting("src").containsExactly("https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/ChatGPT-Image-Sep-29-2026-05_55_12-PM-5_Cb2atILB0.png");
        assertThat(products.findBySourceId("p-fk-monin-melon-70cl").orElseThrow().getImages())
                .extracting("src").containsExactly("/img/products/catalogue/monin-sirop-melon-70cl.v2.webp");
        assertThat(products.findBySourceId("p-fk-tablier-polyethylene").orElseThrow().getImages())
                .extracting("src").containsExactly("https://ik.imagekit.io/owner/tablier.webp");
        // Every start re-evaluates the terms; once they hold, nothing changes.
        assertThat(runner.apply(batch)).isEqualTo(CatalogReconciliationRunner.Outcome.ALREADY_APPLIED);
    }
}
