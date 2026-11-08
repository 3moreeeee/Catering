package tn.com.catering.identity.services;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The order of the catalogue while browsing: varied, led by what can be bought
 * today, and different from one day to the next.
 *
 * <ul>
 *   <li>Products that can be ordered now (price, photograph, stock) come first.
 *   <li>Divisions, families and the sizes of one product are woven together, so
 *       neighbouring cards differ. Small divisions still reach the first page.
 *   <li>Promoted products lead their family, and their family leads its division.
 *   <li>Everything else varies with the date: the list feels fresh each day, yet
 *       is identical for every page of that day, so pagination neither repeats
 *       nor skips a product.
 * </ul>
 *
 * Pure and database-independent: it only sees the handful of fields below.
 */
final class CatalogueMerchandising {

    record Item(UUID id, String division, String family, String name, boolean promoted, boolean orderable) {}

    private record Ranked(Item item, double position) {}

    private CatalogueMerchandising() {}

    static List<UUID> arrange(List<Item> items, LocalDate day) {
        String salt = day.toString();
        List<Item> arranged = new ArrayList<>(items.size());
        arranged.addAll(weave(items.stream().filter(Item::orderable).toList(), salt));
        arranged.addAll(weave(items.stream().filter(item -> !item.orderable()).toList(), salt));
        return arranged.stream().map(Item::id).toList();
    }

    private static List<Item> weave(List<Item> items, String salt) {
        Map<String, List<Item>> divisions = groupBy(items, Item::division);
        divisions.replaceAll((division, members) -> {
            Map<String, List<Item>> families = groupBy(members, item -> String.valueOf(item.family()));
            families.replaceAll((family, sameFamily) -> {
                Map<String, List<Item>> stems = groupBy(sameFamily, item -> stem(item.name()));
                stems.replaceAll((stem, sameStem) -> leadingWithPromoted(sameStem, salt));
                return spread(stems, salt);
            });
            return spread(families, salt);
        });
        return spread(divisions, salt);
    }

    private static Map<String, List<Item>> groupBy(List<Item> items, Function<Item, String> key) {
        return items.stream().collect(Collectors.groupingBy(key, TreeMap::new, Collectors.toCollection(ArrayList::new)));
    }

    private static List<Item> leadingWithPromoted(List<Item> items, String salt) {
        return items.stream()
                .sorted(Comparator.comparing((Item item) -> !item.promoted())
                        .thenComparingDouble(item -> fraction(salt, item.id().toString())))
                .toList();
    }

    /**
     * Merges groups so each is spaced evenly. Dividing by the square root of the
     * group's size lets a 21-product division keep pace with a 156-product one
     * at the top of the list instead of appearing once every seven cards.
     */
    private static List<Item> spread(Map<String, List<Item>> groups, String salt) {
        List<Ranked> ranked = new ArrayList<>();
        groups.forEach((key, members) -> {
            boolean promoted = members.stream().anyMatch(Item::promoted);
            double phase = fraction(salt, key) * 0.5 + (promoted ? 0 : 0.5);
            double spacing = Math.sqrt(members.size());
            for (int index = 0; index < members.size(); index++) {
                ranked.add(new Ranked(members.get(index), (index + phase) / spacing));
            }
        });
        return ranked.stream()
                .sorted(Comparator.comparingDouble(Ranked::position)
                        .thenComparing(entry -> entry.item().id()))
                .map(Ranked::item)
                .toList();
    }

    /**
     * The words that identify a product line, so "Caissettes N°5" and "N°6" are
     * recognised as the same product in another size.
     */
    static String stem(String name) {
        String plain = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        return Arrays.stream(plain.split("[^a-z0-9]+"))
                .filter(word -> word.length() > 2 && word.chars().allMatch(Character::isLetter))
                .limit(2)
                .collect(Collectors.joining(" "));
    }

    /** A stable pseudo-random value in [0, 1) for this text on this day. */
    private static double fraction(String salt, String text) {
        int hash = (salt + '|' + text).hashCode();
        hash ^= hash >>> 16;
        hash *= 0x9E3779B1;
        hash ^= hash >>> 15;
        return Integer.toUnsignedLong(hash) / 0x1p32;
    }
}
