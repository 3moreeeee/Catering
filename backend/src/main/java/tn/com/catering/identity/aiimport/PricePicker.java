package tn.com.catering.identity.aiimport;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tn.com.catering.identity.entities.SaleMode;

/**
 * Finds a photographed product's price in the company price lists.
 *
 * <ol>
 *   <li>Code ranks the price-list rows against the names known for the product
 *       (the file name and the name the model read on the photo) and keeps the
 *       five closest;</li>
 *   <li>the model chooses one of the five, or none, and says whether the
 *       printed price is for one piece or for the whole packaging;</li>
 *   <li>code turns that row into the storefront's lot pricing: a unit price
 *       times a lot size, exactly as the catalogue sells today.</li>
 * </ol>
 *
 * <p>The model never writes a number: the price is the row's own, as printed.
 */
@Component
public class PricePicker {

    static final int CANDIDATES = 5;
    private static final BigDecimal MILLIME = new BigDecimal("0.001");
    /** "de 50", "les 100", "lot de 5", "100 pcs", "250 pièces" — a lot size written in a name. */
    private static final Pattern LOT = Pattern.compile(
            "(?i)(?:\\b(?:de|les|lot de|x)\\s*(\\d{2,5})\\b(?!\\s*(?:ml|cl|l|g|gr|kg|mm|cm|cc|oz|m)\\b))"
                    + "|(?:\\b(\\d{2,5})\\s*(?:pcs|pi[eè]ces?|pieces?)\\b)");

    private final ObjectMapper json;

    public PricePicker(ObjectMapper json) {
        this.json = json;
    }

    /** What the importer proposes; the administrator confirms it on the review card. */
    public record Suggestion(PriceListRow row, SaleMode saleMode, BigDecimal price, Integer lotQuantity,
                             String unitLabel, String note) {}

    /** The five price-list rows closest to the product's names, best first. */
    public List<PriceListRow> candidates(List<PriceListRow> rows, String... names) {
        record Scored(PriceListRow row, double score) {}
        List<Scored> scored = new ArrayList<>();
        for (PriceListRow row : rows) {
            double best = 0;
            for (String name : names) {
                if (name != null && !name.isBlank()) best = Math.max(best, score(name, row));
            }
            if (best > 0) scored.add(new Scored(row, best));
        }
        return scored.stream()
                .sorted(Comparator.comparingDouble(Scored::score).reversed())
                .limit(CANDIDATES)
                .map(Scored::row)
                .toList();
    }

    /** Share of the product's words found in the row (half weight for the list and section names), sizes agreeing. */
    static double score(String productName, PriceListRow row) {
        Set<String> wanted = words(ProductMatcher.tokens(productName));
        if (wanted.isEmpty()) return 0;
        Set<String> inRow = ProductMatcher.tokens(row.getName());
        Set<String> inContext = ProductMatcher.tokens(row.getListName() + " " + (row.getSection() == null ? "" : row.getSection()));
        double common = 0;
        for (String word : wanted) {
            if (inRow.contains(word)) common += 1;
            else if (inContext.contains(word)) common += 0.5;
        }
        double score = common / wanted.size();
        Set<String> sizesWanted = ProductMatcher.sizes(productName);
        Set<String> sizesRow = ProductMatcher.sizes(row.getName());
        if (!sizesWanted.isEmpty() && !sizesRow.isEmpty()) {
            Set<String> shared = new HashSet<>(sizesWanted);
            shared.retainAll(sizesRow);
            score += shared.isEmpty() ? -0.3 : 0.3;
        }
        return score;
    }

    private static Set<String> words(Set<String> tokens) {
        Set<String> words = new HashSet<>();
        for (String token : tokens) {
            if (!token.matches("\\d+(_\\d+)?") && !Set.of("ml", "cl", "l", "g", "kg", "mm", "cm", "m", "cc", "oz").contains(token)) {
                words.add(token);
            }
        }
        return words;
    }

    public String systemPrompt() {
        return """
                Tu associes un produit photographié à une ligne de la liste de prix de l'entreprise.
                On te donne le produit (nom lu sur la photo, nom du fichier, format) et au plus cinq lignes
                numérotées de la liste de prix.

                Le nom du fichier est le titre donné par l'entreprise elle-même : si une ligne correspond
                clairement au nom du fichier, choisis-la, même si la description de la photo est moins précise
                (« grand master chef » → « Toque Master Chef »). Ne l'écarte que si la photo montre sans doute
                possible un autre produit.

                Choisis une ligne seulement si c'est le MÊME article : même type, même taille, contenance ou
                dimension, même couleur si elle est précisée. Une ligne voisine (autre taille, autre parfum,
                autre couleur) n'est pas le même article : réponds alors null.

                Dis aussi pour quoi est le prix imprimé :
                - "piece" : le prix d'une seule pièce, bouteille, boîte ou rouleau (ex. 0,090 pour une
                  fourchette vendue par carton de 1000 ; 23,848 pour une bouteille vendue par carton de 6) ;
                - "packaging" : le prix de tout le conditionnement indiqué (ex. 5,500 pour un paquet de
                  1000 caissettes ; 17,000 pour 1000 papiers dentelle ; 14,000 pour 100 piques ; 27,000
                  pour 1000 pailles). Une pique, une paille, une caissette ou un papier dentelle ne coûte
                  jamais plusieurs dinars à la pièce.

                Réponds uniquement en JSON :
                {"choice": 1, "priceFor": "piece", "unitLabel": "piece", "reason": "…"}
                choice est le numéro de la ligne ou null. unitLabel est l'unité d'une pièce parmi :
                piece, gobelet, barquette, sachet, boite, rouleau, bouteille, paire, feuille, bol, pot,
                paille, pique, sac, can.
                """;
    }

    public String userText(ProductDraft draft, String fileTitle, List<PriceListRow> candidates) {
        StringBuilder text = new StringBuilder("Produit :\n");
        text.append("- nom lu sur la photo : ").append(draft.nameFr()).append('\n');
        if (draft.nameEn() != null) text.append("- nom anglais : ").append(draft.nameEn()).append('\n');
        text.append("- nom du fichier : ").append(fileTitle).append('\n');
        if (draft.formatValue() != null) text.append("- format : ").append(draft.formatValue()).append('\n');
        if (draft.shortDescriptionFr() != null) text.append("- description : ").append(draft.shortDescriptionFr()).append('\n');
        text.append("\nLignes de la liste de prix :\n");
        for (int index = 0; index < candidates.size(); index++) {
            text.append(index + 1).append(". ").append(candidates.get(index).describe()).append('\n');
        }
        return text.toString();
    }

    /** Reads the model's choice; empty when it chose none or answered something unusable. */
    public Optional<Choice> parseChoice(String raw, int candidateCount) {
        if (raw == null) return Optional.empty();
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) return Optional.empty();
        try {
            JsonNode node = json.readTree(raw.substring(start, end + 1));
            JsonNode choice = node.path("choice");
            int index = choice.canConvertToInt() ? choice.asInt()
                    : choice.isTextual() && choice.asText().matches("\\d+") ? Integer.parseInt(choice.asText()) : -1;
            if (index < 1 || index > candidateCount) return Optional.empty();
            boolean forPackaging = "packaging".equalsIgnoreCase(node.path("priceFor").asText(""));
            String unit = node.path("unitLabel").asText("").toLowerCase();
            if (!ImportTaxonomy.UNIT_LABELS.contains(unit)) unit = null;
            String reason = node.path("reason").asText(null);
            return Optional.of(new Choice(index - 1, forPackaging, unit, reason));
        } catch (JsonProcessingException unreadable) {
            return Optional.empty();
        }
    }

    public record Choice(int index, boolean priceForPackaging, String unitLabel, String reason) {}

    /**
     * The storefront price for the chosen row.
     *
     * <p>A price per piece becomes a lot: the unit price times the lot size
     * named in the product or file name ("de 100"), or else the carton. A
     * price for the whole packaging is divided into a unit price when it falls
     * on whole millimes, and is otherwise kept as the price of one lot.
     */
    public Suggestion price(PriceListRow row, Choice choice, Integer draftLot, String... names) {
        String unit = choice.unitLabel() == null ? "piece" : choice.unitLabel();
        Integer carton = row.getCartonQuantity();
        Integer namedLot = draftLot != null && draftLot > 1 ? draftLot : lotIn(names);
        // Decided by code, not by the model: measured on the 13 lists, every
        // packet price has a packet of 100 or more and costs five dinars or
        // more (picks, doilies, straws, piping bags); every other price is per
        // piece (a 3,000 toque sold by 10, a 3,500 film roll sold by 6). The
        // model got this wrong on 3 of 20 photographs; the rule on none.
        boolean packet = isPackPrice(row);
        if (packet) {
            if (carton == null || carton <= 1) {
                return new Suggestion(row, SaleMode.UNIT, row.getUnitPrice(), null, unit,
                        "Prix du conditionnement « " + row.getPriceText() + " » vendu à l'unité.");
            }
            BigDecimal perPiece = row.getUnitPrice().divide(BigDecimal.valueOf(carton), 6, RoundingMode.HALF_UP);
            if (wholeMillimes(row.getUnitPrice(), carton)) {
                // The lot named on the product ("DE 250") wins over the supplier's packet (1000).
                int lot = namedLot != null ? namedLot : carton;
                return new Suggestion(row, SaleMode.PACK_ONLY, perPiece.setScale(3, RoundingMode.UNNECESSARY), lot, unit,
                        "Prix du paquet de " + carton + " (" + row.getPriceText() + " TND) = "
                                + perPiece.setScale(3, RoundingMode.UNNECESSARY).toPlainString().replace('.', ',')
                                + " TND la pièce.");
            }
            return new Suggestion(row, SaleMode.UNIT, row.getUnitPrice(), carton, unit,
                    "Prix pour un lot de " + carton + " : " + row.getPriceText() + " TND.");
        }
        Integer lot = namedLot;
        String note = null;
        if (lot == null) {
            lot = carton;
            if (lot != null && lot > 100) {
                note = "Lot proposé = carton complet (" + lot + "). Ajustez si vous vendez par plus petits lots.";
            }
        }
        if (lot == null || lot <= 1) {
            return new Suggestion(row, SaleMode.UNIT, row.getUnitPrice(), null, unit, note);
        }
        return new Suggestion(row, SaleMode.PACK_ONLY, row.getUnitPrice(), lot, unit, note);
    }

    /**
     * A safety net on the model's reading: in these lists nothing sold by
     * cartons of a hundred or more costs five dinars a piece, so such a price
     * is the price of the packet (14,000 for 100 picks; 39,000 for 1000
     * doilies) — whatever the model said. A 3,353 polycarbonate glass in
     * cartons of 50, or 0,195 cups in cartons of 1000, stay prices per piece.
     */
    private static boolean wholeMillimes(BigDecimal total, int pieces) {
        BigDecimal perPiece = total.divide(BigDecimal.valueOf(pieces), 6, RoundingMode.HALF_UP);
        return perPiece.compareTo(MILLIME) >= 0 && perPiece.stripTrailingZeros().scale() <= 3;
    }

    static boolean isPackPrice(PriceListRow row) {
        return row.getCartonQuantity() != null && row.getCartonQuantity() >= 100
                && row.getUnitPrice().compareTo(new BigDecimal("5.000")) >= 0;
    }

    static Integer lotIn(String... names) {
        for (String name : names) {
            if (name == null) continue;
            // File names separate words with "_" or "-": "DENTELLE_ROND_190_DE_250".
            Matcher matcher = LOT.matcher(name.replace('_', ' ').replace('-', ' '));
            if (matcher.find()) {
                int value = Integer.parseInt(matcher.group(1) != null ? matcher.group(1) : matcher.group(2));
                if (value > 1 && value <= 100_000) return value;
            }
        }
        return null;
    }
}
