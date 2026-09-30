package tn.com.catering.identity.services;

import java.util.List;
import tn.com.catering.identity.DTO.LocalizedText;

/**
 * Supplier lines sold in several colours. Each colour keeps its own SKU (own
 * reference, photograph and price), but the supplier price list names the line
 * once, so the catalogue lists it once, under the canonical SKU, with a colour
 * choice. The other colours stay orderable by id and reachable by slug.
 *
 * <p>This used to be applied in the browser over the whole bundled catalogue;
 * applied here, a paginated page, its total and its facet counts agree.
 */
public final class ColorVariantGroups {

    public record Member(String sourceId, LocalizedText label, String swatch) {}

    public record Group(String canonicalId, LocalizedText name, List<Member> members) {}

    public static final List<Group> GROUPS = List.of(
            new Group("p-vinto-348",
                    new LocalizedText("Verrine goutte 11ml transparente / noire- LES 50 PIÈCES",
                            "Drop verrine 11 ml clear / black, pack of 50 pieces"),
                    List.of(
                            new Member("p-vinto-348", new LocalizedText("Transparente", "Clear"), "#e3ebef"),
                            new Member("p-vinto-183", new LocalizedText("Noire", "Black"), "#1f1f1f"))),
            new Group("p-vinto-151",
                    new LocalizedText("Calot rayé rouge-bleu en papier- LES 100 PIÈCES",
                            "Striped paper cap red / blue, pack of 100 pieces"),
                    List.of(
                            new Member("p-vinto-151", new LocalizedText("Rayure rouge", "Red stripe"), "#c62828"),
                            new Member("p-vinto-349", new LocalizedText("Rayure bleue", "Blue stripe"), "#1e4fa3"))));

    private ColorVariantGroups() {}

    public static List<String> memberIds() {
        return GROUPS.stream().flatMap(group -> group.members().stream()).map(Member::sourceId).toList();
    }
}
