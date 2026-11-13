package tn.com.catering.identity.aiimport;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Builds the instructions sent to the model and turns its answer into a
 * {@link ProductDraft} that fits the database.
 *
 * <p>The parser is deliberately lenient on optional fields (an unknown brand or
 * subcategory is dropped, an over-long text is cut) and strict on the two that
 * make a product displayable: a French name and a real division. A reply
 * missing either is rejected and the image is retried.
 */
@Component
public class ProductDraftParser {

    private final ObjectMapper json;

    public ProductDraftParser(ObjectMapper json) {
        this.json = json;
    }

    public String systemPrompt(ImportTaxonomy taxonomy) {
        StringBuilder prompt = new StringBuilder("""
                Tu rédiges les fiches produit du catalogue B2B de la Société Ferid Khemakhem (Tunisie),
                importateur et distributeur depuis 1985 de produits agro-alimentaires, MONIN, emballage
                et hygiène pour les professionnels (restaurants, cafés, hôtels, traiteurs, industrie).

                On te donne la photo d'un produit et le nom du fichier envoyé par le client.
                Le nom du fichier est le titre fourni par l'entreprise : c'est la source de vérité pour le
                nom du produit, la marque, le volume, le poids et le nombre de pièces. Utilise la photo pour
                compléter et vérifier (texte de l'étiquette, type d'emballage, couleur, matière).

                Règles :
                - N'invente rien qui ne soit ni dans le nom du fichier ni visible sur la photo : pas d'origine,
                  de certification, d'allergène, de composition, de durée de conservation ni de prix.
                - Nom français dans le style du catalogue, par exemple « Sirop de fraise MONIN 70cl »,
                  « Barquette à sushi 224x142x30mm - Les 100 pièces ». Corrige l'orthographe et les majuscules
                  du nom de fichier, garde les mesures.
                - Nom anglais : vraie traduction naturelle (« MONIN Strawberry Syrup 70cl »), jamais un mélange.
                - shortDescription : une phrase (max 160 caractères) qui dit à quoi sert le produit pour un pro.
                - description : 2 à 3 phrases professionnelles et factuelles, sans superlatifs.
                - format : la contenance ou la dimension telle qu'écrite (« 70 cl », « 2 kg », « 224 × 142 × 30 mm »),
                  ou null.
                - packQuantity : nombre de pièces par lot seulement s'il est écrit (« LES 100 PIÈCES » → 100), sinon null.
                - unitLabel : l'unité d'une pièce du lot, dans la liste fournie, sinon null.
                - categoryId, subcategoryId, brandId et industries : uniquement des identifiants des listes
                  ci-dessous. subcategoryId doit appartenir à categoryId ; choisis le niveau le plus précis
                  (« Verres et gobelets › Gobelets en PET » plutôt que « Verres et gobelets »). Mets null si
                  rien ne convient.
                - fileNameMatches : false uniquement si le nom du fichier désigne clairement un AUTRE produit
                  que celui de la photo (exemple : fichier « Champignons en tranches 850g » mais la boîte
                  photographiée est du maïs doux). Dans ce cas, le nom, la description et le format doivent
                  décrire ce que montre la photo. Un nom en anglais, un code article, un nom incomplet ou
                  une faute d'orthographe ne sont PAS une contradiction : réponds true.

                Réponds uniquement avec un objet JSON, sans texte autour, de cette forme :
                {"nameFr":"","nameEn":"","shortDescriptionFr":"","shortDescriptionEn":"","descriptionFr":"",
                 "descriptionEn":"","categoryId":"","subcategoryId":null,"brandId":null,"industries":[],
                 "format":null,"packQuantity":null,"unitLabel":null,"fileNameMatches":true}

                Divisions (categoryId) et sous-catégories (subcategoryId) :
                """);
        for (ImportTaxonomy.CategoryOption category : taxonomy.categories()) {
            prompt.append("- ").append(category.id()).append(" (").append(category.nameFr()).append(")");
            if (!category.subcategories().isEmpty()) {
                prompt.append(" : ");
                List<String> subs = new ArrayList<>();
                category.subcategories().forEach(sub -> subs.add(sub.id() + " (" + sub.nameFr() + ")"));
                prompt.append(String.join(", ", subs));
            }
            prompt.append('\n');
        }
        prompt.append("\nMarques (brandId) : ");
        List<String> brands = new ArrayList<>();
        taxonomy.brands().forEach(brand -> brands.add(brand.id() + " (" + brand.name() + ")"));
        prompt.append(brands.isEmpty() ? "aucune" : String.join(", ", brands));
        prompt.append("\nSecteurs (industries) : ").append(String.join(", ", ImportTaxonomy.INDUSTRIES));
        prompt.append("\nUnités (unitLabel) : ").append(String.join(", ", ImportTaxonomy.UNIT_LABELS));
        prompt.append('\n');
        return prompt.toString();
    }

    public String userText(String filename) {
        return "Nom du fichier : « " + filename + " ». Rédige la fiche produit en JSON.";
    }

    public ProductDraft parse(String raw, ImportTaxonomy taxonomy) {
        JsonNode node = readObject(raw);

        String nameFr = text(node, "nameFr", 255);
        if (nameFr == null) throw new DraftRejectedException("Le modèle n'a pas donné de nom français.");
        String categoryId = text(node, "categoryId", 80);
        if (!taxonomy.isDivision(categoryId)) {
            throw new DraftRejectedException("Division inconnue proposée par le modèle : " + categoryId);
        }
        String subcategoryId = text(node, "subcategoryId", 80);
        if (!taxonomy.isSubcategoryOf(subcategoryId, categoryId)) subcategoryId = null;

        String brandId = text(node, "brandId", 80);
        if (brandId != null) {
            Map<String, String> lookup = taxonomy.brandLookup();
            brandId = lookup.get(brandId.toLowerCase());
        }

        Set<String> industries = new LinkedHashSet<>();
        JsonNode industryNode = node.path("industries");
        if (industryNode.isArray()) {
            industryNode.forEach(value -> {
                if (ImportTaxonomy.INDUSTRIES.contains(value.asText())) industries.add(value.asText());
            });
        }
        if (industries.isEmpty()) industries.addAll(List.of("restaurants", "hotels"));

        Integer packQuantity = null;
        JsonNode pack = node.path("packQuantity");
        if (pack.canConvertToInt() && pack.asInt() >= 1 && pack.asInt() <= 100_000) packQuantity = pack.asInt();
        else if (pack.isTextual() && pack.asText().matches("\\d{1,6}")) {
            int value = Integer.parseInt(pack.asText());
            if (value >= 1 && value <= 100_000) packQuantity = value;
        }

        String unitLabel = text(node, "unitLabel", 20);
        if (unitLabel != null && !ImportTaxonomy.UNIT_LABELS.contains(unitLabel.toLowerCase())) unitLabel = null;
        else if (unitLabel != null) unitLabel = unitLabel.toLowerCase();

        return new ProductDraft(
                nameFr,
                text(node, "nameEn", 255),
                text(node, "shortDescriptionFr", 1000),
                text(node, "shortDescriptionEn", 1000),
                text(node, "descriptionFr", 4000),
                text(node, "descriptionEn", 4000),
                categoryId,
                subcategoryId,
                brandId,
                List.copyOf(industries),
                text(node, "format", 160),
                packQuantity,
                unitLabel,
                bool(node.get("fileNameMatches")));
    }

    private static Boolean bool(JsonNode value) {
        if (value == null || value.isNull()) return null;
        if (value.isBoolean()) return value.asBoolean();
        String text = value.asText("").trim().toLowerCase();
        return text.equals("true") ? Boolean.TRUE : text.equals("false") ? Boolean.FALSE : null;
    }

    /** Accepts a bare object, or one wrapped in a ```json fence or a sentence. */
    private JsonNode readObject(String raw) {
        if (raw == null) throw new DraftRejectedException("Réponse vide du modèle.");
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) throw new DraftRejectedException("Le modèle n'a pas renvoyé de JSON.");
        try {
            JsonNode node = json.readTree(raw.substring(start, end + 1));
            if (!node.isObject()) throw new DraftRejectedException("Le modèle n'a pas renvoyé d'objet JSON.");
            return node;
        } catch (JsonProcessingException error) {
            throw new DraftRejectedException("JSON du modèle illisible.");
        }
    }

    private static String text(JsonNode node, String field, int max) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) return null;
        String text = value.asText("").replaceAll("\\s+", " ").trim();
        if (text.isEmpty() || text.equalsIgnoreCase("null")) return null;
        return text.length() > max ? text.substring(0, max).trim() : text;
    }

    public static class DraftRejectedException extends RuntimeException {
        public DraftRejectedException(String message) {
            super(message);
        }
    }
}
