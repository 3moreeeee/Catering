package tn.com.catering.identity.aiimport;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProductMatcherTest {

    private final ProductMatcher matcher = new ProductMatcher();
    private final UUID syrup70 = UUID.randomUUID();
    private final UUID syrup1l = UUID.randomUUID();
    private final UUID sauce = UUID.randomUUID();
    private final List<ProductMatcher.Candidate> catalogue = List.of(
            new ProductMatcher.Candidate(syrup70, "Sirop de fraise MONIN 70cl"),
            new ProductMatcher.Candidate(syrup1l, "Sirop de fraise MONIN 1L"),
            new ProductMatcher.Candidate(sauce, "Sauce caramel MONIN 1,89L"));

    @Test
    void ignoresCaseAccentsPunctuationAndUnitSpacing() {
        assertThat(matcher.best(catalogue, "SIROP FRAISE monin 70 cl.png"))
                .get().extracting(ProductMatcher.Match::id).isEqualTo(syrup70);
        assertThat(matcher.best(catalogue, "sauce caramel Monin 1.89 L"))
                .get().extracting(ProductMatcher.Match::id).isEqualTo(sauce);
    }

    @Test
    void aDifferentSizeIsADifferentProduct() {
        assertThat(matcher.best(catalogue, "Sirop de fraise MONIN 25cl")).isEmpty();
    }

    /** Both measured on the client's real files. */
    @Test
    void sharingBrandSizeAndOneWordIsNotEnough() {
        assertThat(matcher.best(catalogue, "1L POMPE SIROP MONIN")).isEmpty();
        List<ProductMatcher.Candidate> withPump = List.of(
                new ProductMatcher.Candidate(syrup1l, "Sirop de fraise MONIN 1L"),
                new ProductMatcher.Candidate(sauce, "Pompe 10ml MONIN pour sirop 1L"));
        assertThat(matcher.best(withPump, "1L POMPE SIROP MONIN"))
                .get().extracting(ProductMatcher.Match::id).isEqualTo(sauce);
        assertThat(matcher.best(withPump, "Pompe à sirop MONIN pour bouteille verre 1L - dose 10 ml"))
                .get().extracting(ProductMatcher.Match::id).isEqualTo(sauce);
        List<ProductMatcher.Candidate> corn = List.of(
                new ProductMatcher.Candidate(UUID.randomUUID(), "Maïs doux Emporium 184g"),
                new ProductMatcher.Candidate(UUID.randomUUID(), "Maïs doux Emporium 425g"));
        assertThat(matcher.best(corn, "Maïs doux Emporium")).isEmpty();
        assertThat(matcher.best(corn, "Maïs doux EMPORIUM 184 g")).isPresent();
    }

    /** From the ten-photo run: the shaker exists in one size only, so a name without a size still finds it. */
    @Test
    void aNameWithoutASizeFindsTheOnlyProductWithThoseWords() {
        UUID shaker = UUID.randomUUID();
        List<ProductMatcher.Candidate> bar = List.of(
                new ProductMatcher.Candidate(shaker, "Shaker boston MONIN 400ml"),
                new ProductMatcher.Candidate(UUID.randomUUID(), "Pilon MONIN"));
        assertThat(matcher.best(bar, "Shaker Boston MONIN")).get()
                .extracting(ProductMatcher.Match::id).isEqualTo(shaker);
    }

    @Test
    void comparesPhysicalSizesNotPackCounts() {
        UUID cube50 = UUID.randomUUID();
        List<ProductMatcher.Candidate> verrines = List.of(
                new ProductMatcher.Candidate(cube50, "Verrine cube 50ml- LES 50 PIÈCES"));
        assertThat(matcher.best(verrines, "verrine-cube-150ml-le-lot-de-50-pieces")).isEmpty();
        assertThat(matcher.best(verrines, "verrine cube 5cl lot de 50")).isPresent();
        assertThat(ProductMatcher.sizes("Sirop 70cl")).isEqualTo(ProductMatcher.sizes("Sirop 700 ml"));
        assertThat(ProductMatcher.sizes("Sauce 1,89L")).containsExactly("1890ml");
    }

    @Test
    void aLongerAiNameStillFindsTheCatalogueProduct() {
        List<ProductMatcher.Candidate> frappe = List.of(
                new ProductMatcher.Candidate(UUID.randomUUID(), "Frappé neutre MONIN sac 2kg"));
        assertThat(matcher.best(frappe, "Base frappé neutre MONIN sac 2 kg")).isPresent();
    }

    @Test
    void fileNamesWithUnderscoresAreSplitIntoWords() {
        UUID boat = UUID.randomUUID();
        List<ProductMatcher.Candidate> verrines = List.of(
                new ProductMatcher.Candidate(boat, "Bateau ovale 7cm x 12cm- LES 100 PIÈCES"),
                new ProductMatcher.Candidate(UUID.randomUUID(), "Bateau ovale 8cm x 13.5cm- LES 100 PIÈCES"));
        assertThat(matcher.best(verrines, "bateau_ovale_7_12")).get()
                .extracting(ProductMatcher.Match::id).isEqualTo(boat);
    }

    @Test
    void unrelatedNamesDoNotMatch() {
        assertThat(matcher.best(catalogue, "Gant nitrile les 100 pièces")).isEmpty();
    }
}
