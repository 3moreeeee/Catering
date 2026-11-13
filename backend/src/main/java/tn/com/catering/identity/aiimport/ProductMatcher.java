package tn.com.catering.identity.aiimport;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Finds the catalogue product a photograph most likely belongs to, so the
 * importer can propose replacing its image instead of creating a duplicate.
 *
 * <p>Names are compared as sets of normalised words (accents, case, punctuation
 * and unit spellings ignored), with three rules tuned on the client's files,
 * where a wrong match would put a photograph on another product:
 * <ul>
 *   <li>every word of the shorter name must appear in the longer one, so
 *       "1L POMPE SIROP MONIN" never matches "Sirop de fraise MONIN 1L"
 *       ("pompe" is missing) yet does match "Pompe 10ml MONIN pour sirop 1L";</li>
 *   <li>sizes must be compatible: "70cl" never matches "1L";</li>
 *   <li>a name without a size cannot confirm one, so "Maïs doux Emporium" does
 *       not settle on the 184 g can.</li>
 * </ul>
 */
@Component
public class ProductMatcher {

    /** Reached when the names are compatible and share at least half the words of the longer one. */
    static final double THRESHOLD = 0.75;

    private static final Set<String> UNITS = Set.of("ml", "cl", "l", "g", "kg", "mm", "cm", "m", "x", "oz");

    private static final Set<String> STOPWORDS = Set.of(
            "de", "du", "des", "la", "le", "les", "l", "d", "en", "et", "a", "au", "aux", "pour",
            "avec", "sans", "un", "une", "par", "piece", "pieces", "pcs", "pc", "the", "of", "and",
            "png", "jpg", "jpeg", "webp", "avif");

    public record Candidate(UUID id, String name) {}

    public record Match(UUID id, String name, double score) {}

    public Optional<Match> best(List<Candidate> candidates, String... names) {
        Match best = null;
        List<Name> catalogue = candidates.stream().map(candidate -> Name.of(candidate.name())).toList();
        for (String name : names) {
            if (name == null || name.isBlank()) continue;
            Name wanted = Name.of(name);
            if (wanted.tokens().isEmpty()) continue;
            for (int index = 0; index < candidates.size(); index++) {
                double score = score(wanted, catalogue.get(index));
                Candidate candidate = candidates.get(index);
                if (best == null || score > best.score()) best = new Match(candidate.id(), candidate.name(), score);
            }
        }
        if (best != null && best.score() >= THRESHOLD) return Optional.of(best);
        return onlySizedVariant(candidates, catalogue, names);
    }

    /**
     * "Shaker Boston MONIN" names no size, so it cannot confirm "Shaker boston
     * MONIN 400ml" by itself — unless that is the only product with those
     * words. With several sizes on file ("Maïs doux Emporium" 184 g, 425 g,
     * 3100 ml) the name stays ambiguous and nothing is matched.
     */
    private static Optional<Match> onlySizedVariant(List<Candidate> candidates, List<Name> catalogue, String... names) {
        for (String name : names) {
            if (name == null || name.isBlank()) continue;
            Name wanted = Name.of(name);
            if (!wanted.sizes().isEmpty() || !numbers(wanted.tokens()).isEmpty()) continue;
            Set<String> words = words(wanted.tokens());
            if (words.isEmpty()) continue;
            Match only = null;
            int found = 0;
            for (int index = 0; index < candidates.size(); index++) {
                Name other = catalogue.get(index);
                if (words(other.tokens()).equals(words)) {
                    found++;
                    only = new Match(candidates.get(index).id(), candidates.get(index).name(), THRESHOLD);
                }
            }
            if (found == 1) return Optional.of(only);
        }
        return Optional.empty();
    }

    /** A name's words and its physical sizes, the latter in a common unit (70 cl and 700 ml are equal). */
    record Name(Set<String> tokens, Set<String> sizes) {
        static Name of(String value) {
            return new Name(ProductMatcher.tokens(value), ProductMatcher.sizes(value));
        }
    }

    /** 0 for incompatible names; otherwise 0.5 + half the share of the longer name's words in common. */
    static double score(Name nameA, Name nameB) {
        // Physical sizes first: "Verrine cube 150ml - lot de 50" is not the 50 ml
        // cube, although both names contain a 50.
        if (!nameA.sizes().isEmpty() && !nameB.sizes().isEmpty()
                && !nameA.sizes().containsAll(nameB.sizes()) && !nameB.sizes().containsAll(nameA.sizes())) {
            return 0;
        }
        Set<String> a = nameA.tokens();
        Set<String> b = nameB.tokens();
        Set<String> wordsA = words(a);
        Set<String> wordsB = words(b);
        if (wordsA.isEmpty() || wordsB.isEmpty()) return 0;
        Set<String> common = new HashSet<>(wordsA);
        common.retainAll(wordsB);
        int shorter = Math.min(wordsA.size(), wordsB.size());
        int longer = Math.max(wordsA.size(), wordsB.size());
        // Every word of a short name must be there; a long name may miss one in four.
        double containment = (double) common.size() / shorter;
        if (containment < (shorter >= 4 ? 0.75 : 1.0)) return 0;
        double coverage = (double) common.size() / longer;

        Set<String> numbersA = numbers(a);
        Set<String> numbersB = numbers(b);
        if (!numbersA.isEmpty() && !numbersB.isEmpty()) {
            if (!numbersA.containsAll(numbersB) && !numbersB.containsAll(numbersA)) return 0;
        } else if (numbersA.isEmpty() != numbersB.isEmpty()) {
            coverage *= 0.4;
        }
        return 0.5 + coverage / 2;
    }

    private static Set<String> words(Set<String> tokens) {
        return tokens.stream()
                .filter(word -> !word.matches("\\d+(_\\d+)?") && !UNITS.contains(word))
                .collect(Collectors.toSet());
    }

    static Set<String> tokens(String value) {
        String text = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase();
        // File names join words with "_": "bateau_ovale_7_12" is four words.
        text = text.replace('_', ' ');
        text = text.replaceAll("\\.(png|jpe?g|webp|avif)$", " ");
        text = text.replaceAll("(\\d)[,.](\\d)", "$1_$2");      // 1,89 and 1.89 read the same
        text = text.replaceAll("(\\d)([a-z])", "$1 $2");          // 70cl -> 70 cl
        text = text.replaceAll("([a-z])(\\d)", "$1 $2");
        text = text.replaceAll("[^a-z0-9_ ]", " ");
        return Arrays.stream(text.split("\\s+"))
                .filter(word -> !word.isBlank() && !STOPWORDS.contains(word))
                .map(ProductMatcher::unit)
                .collect(Collectors.toCollection(HashSet::new));
    }

    private static String unit(String word) {
        return switch (word) {
            case "gr", "grs", "gramme", "grammes" -> "g";
            case "litre", "litres", "lt", "ltr" -> "l";
            case "kilo", "kilos" -> "kg";
            // Singular and plural read the same: "noisette grillée" / "Noisettes grillées".
            default -> word.length() > 3 && word.endsWith("s") && !word.endsWith("ss") && !word.matches(".*\\d.*")
                    ? word.substring(0, word.length() - 1) : word;
        };
    }

    private static final java.util.regex.Pattern SIZE = java.util.regex.Pattern.compile(
            "(\\d+(?:[.,]\\d+)?)\\s*(ml|cl|cc|l|litres?|kg|gr|g|mm|cm|m|oz)(?![a-z])");

    /** Every "number + unit" in a name, converted to ml, g, mm or oz so that 70cl, 70 cl and 700ml agree. */
    static Set<String> sizes(String value) {
        String text = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase();
        Set<String> sizes = new HashSet<>();
        java.util.regex.Matcher found = SIZE.matcher(text);
        while (found.find()) {
            java.math.BigDecimal amount = new java.math.BigDecimal(found.group(1).replace(',', '.'));
            String unit = found.group(2);
            java.math.BigDecimal factor;
            String base;
            switch (unit) {
                case "cl" -> { factor = java.math.BigDecimal.TEN; base = "ml"; }
                case "l", "litre", "litres" -> { factor = java.math.BigDecimal.valueOf(1000); base = "ml"; }
                case "ml", "cc" -> { factor = java.math.BigDecimal.ONE; base = "ml"; }
                case "kg" -> { factor = java.math.BigDecimal.valueOf(1000); base = "g"; }
                case "g", "gr" -> { factor = java.math.BigDecimal.ONE; base = "g"; }
                case "cm" -> { factor = java.math.BigDecimal.TEN; base = "mm"; }
                case "m" -> { factor = java.math.BigDecimal.valueOf(1000); base = "mm"; }
                case "mm" -> { factor = java.math.BigDecimal.ONE; base = "mm"; }
                default -> { factor = java.math.BigDecimal.ONE; base = unit; }
            }
            sizes.add(amount.multiply(factor).stripTrailingZeros().toPlainString() + base);
        }
        return sizes;
    }

    private static Set<String> numbers(Set<String> tokens) {
        return tokens.stream().filter(word -> word.matches("\\d+(_\\d+)?")).collect(Collectors.toSet());
    }
}
