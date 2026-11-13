package tn.com.catering.identity.aiimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductDraftParserTest {

    private final ProductDraftParser parser = new ProductDraftParser(new ObjectMapper());
    private final ImportTaxonomy taxonomy = new ImportTaxonomy(
            List.of(new ImportTaxonomy.CategoryOption("packaging", "Emballage",
                            List.of(new ImportTaxonomy.SubcategoryOption("packaging-trays", "Barquettes"))),
                    new ImportTaxonomy.CategoryOption("hygiene", "Hygiène", List.of())),
            List.of(new ImportTaxonomy.BrandOption("caterware", "Caterware")));

    @Test
    void keepsValidFieldsAndDropsInventedOnes() {
        ProductDraft draft = parser.parse("""
                Voici la fiche : {"nameFr":"  Barquette à sushi 224x142x30mm - Les 100 pièces ",
                 "categoryId":"packaging","subcategoryId":"hygiene-gloves","brandId":"Unknown brand",
                 "industries":["restaurants","space"],"packQuantity":"100","unitLabel":"Barquette",
                 "format":"224 × 142 × 30 mm","price":12}
                """, taxonomy);

        assertThat(draft.nameFr()).isEqualTo("Barquette à sushi 224x142x30mm - Les 100 pièces");
        assertThat(draft.categoryId()).isEqualTo("packaging");
        assertThat(draft.subcategoryId()).isNull();
        assertThat(draft.brandId()).isNull();
        assertThat(draft.industries()).containsExactly("restaurants");
        assertThat(draft.packQuantity()).isEqualTo(100);
        assertThat(draft.unitLabel()).isEqualTo("barquette");
        assertThat(draft.formatValue()).isEqualTo("224 × 142 × 30 mm");
        assertThat(draft.fileNameMatches()).isNull();
    }

    @Test
    void readsTheFileNameVerdict() {
        assertThat(parser.parse("{\"nameFr\":\"Maïs\",\"categoryId\":\"hygiene\",\"fileNameMatches\":false}", taxonomy)
                .fileNameMatches()).isFalse();
        assertThat(parser.parse("{\"nameFr\":\"Maïs\",\"categoryId\":\"hygiene\",\"fileNameMatches\":\"true\"}", taxonomy)
                .fileNameMatches()).isTrue();
    }

    @Test
    void resolvesBrandsByNameAndDefaultsIndustries() {
        ProductDraft draft = parser.parse(
                "{\"nameFr\":\"Plateau\",\"categoryId\":\"packaging\",\"brandId\":\"CATERWARE\",\"packQuantity\":0}",
                taxonomy);
        assertThat(draft.brandId()).isEqualTo("caterware");
        assertThat(draft.industries()).containsExactly("restaurants", "hotels");
        assertThat(draft.packQuantity()).isNull();
    }

    @Test
    void rejectsAnswersWithoutANameOrARealDivision() {
        assertThatThrownBy(() -> parser.parse("{\"categoryId\":\"packaging\"}", taxonomy))
                .isInstanceOf(ProductDraftParser.DraftRejectedException.class);
        assertThatThrownBy(() -> parser.parse("{\"nameFr\":\"X\",\"categoryId\":\"food\"}", taxonomy))
                .isInstanceOf(ProductDraftParser.DraftRejectedException.class);
        assertThatThrownBy(() -> parser.parse("pas de json", taxonomy))
                .isInstanceOf(ProductDraftParser.DraftRejectedException.class);
    }

    @Test
    void thePromptListsOnlyTheRealTaxonomy() {
        String prompt = parser.systemPrompt(taxonomy);
        assertThat(prompt).contains("packaging (Emballage) : packaging-trays (Barquettes)")
                .contains("caterware (Caterware)")
                .contains("restaurants, hotels, retail");
    }
}
