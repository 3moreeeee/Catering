package tn.com.catering.identity.aiimport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ProductImportServiceTest {

    @Test
    void repairsFileNamesMangledByAZipEncodingMismatch() {
        assertThat(ProductImportService.repairFilename("Frapp├⌐ caf├⌐ MONIN sac 2kg.png"))
                .isEqualTo("Frappé café MONIN sac 2kg.png");
        assertThat(ProductImportService.repairFilename("Bac de stockage ├á gla├ºons MONIN 6L.png"))
                .isEqualTo("Bac de stockage à glaçons MONIN 6L.png");
    }

    @Test
    void leavesCorrectFileNamesAlone() {
        assertThat(ProductImportService.repairFilename("Maïs doux Emporium 425g.png"))
                .isEqualTo("Maïs doux Emporium 425g.png");
        assertThat(ProductImportService.repairFilename("GOBELET EPS.jpg")).isEqualTo("GOBELET EPS.jpg");
    }

    @Test
    void slugsAreAsciiAndHyphenated() {
        assertThat(ProductImportService.slugify("Sirop de fraise MONIN 70cl – Les 6 bouteilles"))
                .isEqualTo("sirop-de-fraise-monin-70cl-les-6-bouteilles");
    }
}
