package tn.com.catering.identity.services;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import tn.com.catering.identity.services.CatalogueMerchandising.Item;

class CatalogueMerchandisingTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 8);

    /** Same proportions as the real catalogue, with several sizes of each product line. */
    private final List<Item> catalogue = catalogue();
    private final Map<UUID, Item> byId = catalogue.stream().collect(Collectors.toMap(Item::id, item -> item));

    @Test
    void everyProductAppearsExactlyOnce() {
        assertThat(CatalogueMerchandising.arrange(catalogue, DAY))
                .hasSameSizeAs(catalogue)
                .doesNotHaveDuplicates()
                .containsExactlyInAnyOrderElementsOf(catalogue.stream().map(Item::id).toList());
    }

    @Test
    void theFirstPageShowsEveryDivision() {
        Set<String> divisions = page(0).stream().map(Item::division).collect(Collectors.toSet());
        assertThat(divisions).containsExactlyInAnyOrder("food", "monin", "packaging", "hygiene");
    }

    @Test
    void sizesOfOneProductAreNotNeighbours() {
        List<Item> first = page(0);
        for (int i = 1; i < first.size(); i++) {
            assertThat(CatalogueMerchandising.stem(first.get(i).name()))
                    .as("cards %d and %d", i - 1, i)
                    .isNotEqualTo(CatalogueMerchandising.stem(first.get(i - 1).name()));
        }
    }

    @Test
    void orderableProductsComeBeforeTheOthers() {
        List<UUID> arranged = CatalogueMerchandising.arrange(catalogue, DAY);
        long orderable = catalogue.stream().filter(Item::orderable).count();
        assertThat(arranged.subList(0, (int) orderable)).allMatch(id -> byId.get(id).orderable());
    }

    @Test
    void promotedProductsLeadTheList() {
        assertThat(page(0)).anyMatch(Item::promoted);
        assertThat(arrangedItems().getFirst().promoted()).isTrue();
    }

    @Test
    void theOrderIsStableWithinADayAndChangesTheNext() {
        assertThat(CatalogueMerchandising.arrange(catalogue, DAY))
                .isEqualTo(CatalogueMerchandising.arrange(new ArrayList<>(catalogue).reversed(), DAY))
                .isNotEqualTo(CatalogueMerchandising.arrange(catalogue, DAY.plusDays(1)));
    }

    @Test
    void stemIgnoresSizesAndAccents() {
        assertThat(CatalogueMerchandising.stem("Caissettes à Pâtisserie blanche N°5- LES 250 PIÈCES"))
                .isEqualTo(CatalogueMerchandising.stem("Caissettes à Pâtisserie blanche N°7- LES 250 PIÈCES"))
                .isEqualTo("caissettes patisserie");
    }

    private List<Item> page(int index) {
        return arrangedItems().subList(index * 12, (index + 1) * 12);
    }

    private List<Item> arrangedItems() {
        return CatalogueMerchandising.arrange(catalogue, DAY).stream().map(byId::get).toList();
    }

    private static List<Item> catalogue() {
        Map<String, Integer> sizes = new HashMap<>(Map.of("food", 25, "monin", 91, "packaging", 156, "hygiene", 21));
        List<Item> items = new ArrayList<>();
        sizes.forEach((division, size) -> {
            for (int i = 0; i < size; i++) {
                String line = division + "alpha" + (char) ('a' + i / 3 % 26) + (char) ('a' + i / 78);
                items.add(new Item(new UUID(division.hashCode(), i), division, "family" + i % 5,
                        line + " produit N" + i, i == 1, i % 17 != 16));
            }
        });
        return items;
    }
}
