package tn.com.catering.identity.aiimport;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

class PriceListParserTest {

    private final PriceListParser parser = new PriceListParser();

    @Test
    void namesAListAfterItsFileWithoutTheDate() {
        assertThat(PriceListParser.listName("Liste des Couverts jetables 08 2022.pdf"))
                .isEqualTo("Liste des Couverts jetables");
        assertThat(PriceListParser.listName("Consommables hygiène 06-2026 TC.pdf")).isEqualTo("Consommables hygiène");
    }

    /** Runs on the client's real lists when they are present on this machine (they are not in the repository). */
    @Test
    void readsTheClientsPriceLists() throws Exception {
        Path folder = Path.of("../../Notre Produits");
        Assumptions.assumeTrue(Files.isDirectory(folder), "client price lists not available here");
        int total = 0;
        try (Stream<Path> files = Files.list(folder)) {
            for (Path pdf : files.filter(f -> f.toString().toLowerCase().endsWith(".pdf")).toList()) {
                try (InputStream in = Files.newInputStream(pdf)) {
                    PriceListParser.ParsedList list = parser.parse(in, pdf.getFileName().toString());
                    total += list.rows().size();
                    if (list.listName().startsWith("Liste des Couverts")) {
                        List<PriceListParser.ParsedRow> rows = list.rows();
                        assertThat(rows).hasSize(8);
                        PriceListParser.ParsedRow fork = rows.stream()
                                .filter(row -> row.name().equals("FOURCHETTE EN BOIS")).findFirst().orElseThrow();
                        assertThat(fork.unitPrice()).isEqualByComparingTo(new BigDecimal("0.090"));
                        assertThat(fork.cartonQuantity()).isEqualTo(1000);
                    }
                    assertThat(list.rows()).allSatisfy(row -> assertThat(row.name()).isNotBlank());
                }
            }
        }
        assertThat(total).isGreaterThan(290);
    }
}
