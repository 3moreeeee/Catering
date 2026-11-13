package tn.com.catering.identity.aiimport;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.springframework.stereotype.Component;

/**
 * Reads a company price list: every line carrying a price ("0,090") becomes a
 * row with the article name to its left and the packaging to its right.
 *
 * <p>The lists differ in layout (row numbers, a VAT column, names on two
 * lines, a quantity column), so the parser works on positioned words rather
 * than on one fixed table shape. Names split over several lines are rebuilt
 * from the lines just above the price. Measured on the 13 lists of 2026, it
 * reads 313 priced rows.
 */
@Component
public class PriceListParser {

    private static final Pattern PRICE = Pattern.compile("^\\d{1,4},\\d{3}$");
    private static final Pattern HEADER = Pattern.compile(
            "ARTICLE|PRIX|UNITAIRE|COLISAGE|VISUEL|D[EÉ]SIGNATION|R[EÉ]F[EÉ]RENCE|QUANTIT|TVA|\\(HT\\)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern CONTACT = Pattern.compile(
            "T[ée]l|GSM|Email|E-mail|Site web|Facebook|www\\.|@|Soci[ée]t[ée] Ferid", Pattern.CASE_INSENSITIVE);
    private static final Pattern DATE = Pattern.compile("\\s*\\b\\d{2}[ -]\\d{4}\\b|\\s+TC\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUANTITY = Pattern.compile("(?<![\\d,.])(\\d{1,3}(?: \\d{3})+|\\d+)(?![\\d,.%])");

    public record ParsedRow(int page, String section, String name, BigDecimal unitPrice, String priceText,
                            String packaging, Integer cartonQuantity) {}

    public record ParsedList(String listName, List<ParsedRow> rows) {}

    /** "Liste des Couverts jetables 08 2022.pdf" → "Liste des Couverts jetables". */
    public static String listName(String filename) {
        String base = filename == null ? "Liste" : filename.replaceAll("(?i)\\.pdf$", "");
        return DATE.matcher(base).replaceAll(" ").replaceAll("\\s+", " ").trim();
    }

    public ParsedList parse(InputStream pdf, String filename) throws IOException {
        List<ParsedRow> rows = new ArrayList<>();
        try (PDDocument document = PDDocument.load(pdf)) {
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                rows.addAll(parsePage(document, page));
            }
        }
        return new ParsedList(listName(filename), rows);
    }

    private List<ParsedRow> parsePage(PDDocument document, int page) throws IOException {
        Collector collector = new Collector();
        collector.setStartPage(page);
        collector.setEndPage(page);
        collector.getText(document);

        List<List<Word>> lines = lines(collector.glyphs);
        // Left edge of the packaging column: anything starting right of every
        // price on the page is packaging text, even on its own line
        // ("CARTON DE" / "2000 PCS" printed on two lines beside the price).
        float packagingColumn = (float) lines.stream().flatMap(List::stream)
                .filter(word -> PRICE.matcher(word.text()).matches())
                .mapToDouble(Word::x1).min().orElse(Double.MAX_VALUE);

        List<Draft> drafts = new ArrayList<>();
        List<Word> orphans = new ArrayList<>();
        List<Word> nameLines = new ArrayList<>();
        String section = null;
        for (List<Word> line : lines) {
            String text = String.join(" ", line.stream().map(Word::text).toList()).trim();
            Word price = line.stream().filter(word -> PRICE.matcher(word.text()).matches()).findFirst().orElse(null);
            if (price == null) {
                if (text.isEmpty() || CONTACT.matcher(text).find() || headerWords(text) >= 2) continue;
                Word whole = new Word(text, line.get(0).x0(), line.get(line.size() - 1).x1(), line.get(0).y());
                if (line.stream().allMatch(word -> word.x0() >= packagingColumn - 1)) orphans.add(whole);
                else if (isHeading(text)) section = text;
                else nameLines.add(whole);
                continue;
            }
            String name = join(line.stream().filter(word -> word.x1() <= price.x0() - 0.5).toList());
            String packaging = join(line.stream().filter(word -> word != price && word.x0() >= price.x1() + 0.5).toList());
            drafts.add(new Draft(price.y(), section, name, price.text(), new StringBuilder(packaging), new ArrayList<>()));
        }

        // A description printed over several lines around its price ("Film
        // étirable avec Boite Distributrice, largeur 30cm, / longueur 300
        // mètres…") belongs to the price row nearest to each line, not to
        // whichever row happens to come next. A row with its name on the price
        // line only takes the continuation line just below it.
        for (Word line : nameLines) {
            Draft nearest = nearest(drafts, line.y(), 22);
            if (nearest == null) continue;
            boolean ownName = !nearest.name().isBlank();
            if (!ownName || (line.y() > nearest.y() && line.y() - nearest.y() <= 14)) nearest.extra().add(line);
        }

        // Packaging printed on its own line joins the row nearest to it.
        for (Word orphan : orphans) {
            Draft nearest = nearest(drafts, orphan.y(), 16);
            if (nearest == null) continue;
            if (orphan.y() < nearest.y()) nearest.packaging().insert(0, orphan.text() + " ");
            else nearest.packaging().append(' ').append(orphan.text());
        }

        List<ParsedRow> rows = new ArrayList<>();
        for (Draft draft : drafts) {
            List<Word> parts = new ArrayList<>(draft.extra());
            if (!draft.name().isBlank()) parts.add(new Word(draft.name(), 0, 0, draft.y()));
            parts.sort(Comparator.comparingDouble(Word::y));
            String fullName = String.join(" ", parts.stream().map(Word::text).toList());
            String name = fullName.replaceFirst("^\\d{1,3}\\s+(?=\\D)", "").trim();
            String packaging = draft.packaging().toString().replaceAll("\\s+", " ").trim();
            Integer carton = quantity(packaging);
            Matcher trailing = Pattern.compile("\\s(\\d{1,5})$").matcher(name);
            if (trailing.find()) {
                if (carton == null) carton = Integer.parseInt(trailing.group(1));
                name = name.substring(0, trailing.start()).trim();
            }
            if (name.isBlank()) continue;
            rows.add(new ParsedRow(page, draft.section(), name,
                    new BigDecimal(draft.priceText().replace(',', '.')), draft.priceText(),
                    packaging.isBlank() ? null : packaging, carton));
        }
        return rows;
    }

    private record Draft(float y, String section, String name, String priceText, StringBuilder packaging,
                         List<Word> extra) {}

    private static Draft nearest(List<Draft> drafts, float y, float within) {
        Draft nearest = null;
        for (Draft draft : drafts) {
            float distance = Math.abs(draft.y() - y);
            if (distance <= within && (nearest == null || distance < Math.abs(nearest.y() - y))) nearest = draft;
        }
        return nearest;
    }

    /** Table headers name two or more columns ("Désignation Articles Prix (HT) Colisage Visuel"). */
    private static int headerWords(String text) {
        Matcher matcher = HEADER.matcher(text);
        int count = 0;
        while (matcher.find()) count++;
        return count;
    }

    private static boolean isHeading(String text) {
        return text.length() > 6
                && text.equals(text.toUpperCase(Locale.ROOT))
                && text.chars().anyMatch(Character::isLetter)
                && !text.matches(".*\\d{2,}.*");
    }

    private static Integer quantity(String packaging) {
        if (packaging == null) return null;
        Matcher matcher = QUANTITY.matcher(packaging.replaceAll("\\d+(?:[.,]\\d+)?\\s*%", " "));
        if (!matcher.find()) return null;
        try {
            int value = Integer.parseInt(matcher.group(1).replace(" ", ""));
            return value > 0 && value <= 1_000_000 ? value : null;
        } catch (NumberFormatException tooLong) {
            return null;
        }
    }

    private static String join(List<Word> words) {
        return String.join(" ", words.stream().map(Word::text).toList()).replaceAll("\\s+", " ").trim();
    }

    // --- positioned words -----------------------------------------------------------

    private record Glyph(String text, float x, float y, float width, float space) {}

    record Word(String text, float x0, float x1, float y) {}

    /** Groups glyphs into lines (3 pt bands), then into words at gaps wider than a space. */
    private static List<List<Word>> lines(List<Glyph> glyphs) {
        List<Glyph> sorted = new ArrayList<>(glyphs);
        sorted.sort(Comparator.comparingDouble(Glyph::y).thenComparingDouble(Glyph::x));
        List<List<Glyph>> bands = new ArrayList<>();
        for (Glyph glyph : sorted) {
            List<Glyph> last = bands.isEmpty() ? null : bands.get(bands.size() - 1);
            if (last != null && Math.abs(last.get(0).y() - glyph.y()) <= 3f) last.add(glyph);
            else bands.add(new ArrayList<>(List.of(glyph)));
        }
        List<List<Word>> lines = new ArrayList<>();
        for (List<Glyph> band : bands) {
            band.sort(Comparator.comparingDouble(Glyph::x));
            List<Word> words = new ArrayList<>();
            StringBuilder current = new StringBuilder();
            float start = 0;
            float end = 0;
            for (Glyph glyph : band) {
                boolean blank = glyph.text().isBlank();
                float gap = glyph.x() - end;
                if (current.length() > 0 && (blank || gap > Math.max(1.5f, glyph.space() * 0.6f))) {
                    words.add(new Word(current.toString(), start, end, band.get(0).y()));
                    current.setLength(0);
                }
                if (blank) continue;
                if (current.length() == 0) start = glyph.x();
                current.append(glyph.text());
                end = glyph.x() + glyph.width();
            }
            if (current.length() > 0) words.add(new Word(current.toString(), start, end, band.get(0).y()));
            if (!words.isEmpty()) lines.add(words);
        }
        return lines;
    }

    private static final class Collector extends PDFTextStripper {
        final List<Glyph> glyphs = new ArrayList<>();

        Collector() throws IOException {
            setSortByPosition(true);
        }

        @Override
        protected void processTextPosition(TextPosition text) {
            float space = text.getWidthOfSpace();
            glyphs.add(new Glyph(text.getUnicode(), text.getXDirAdj(), text.getYDirAdj(), text.getWidthDirAdj(),
                    Float.isNaN(space) || space <= 0 ? 2.5f : space));
        }
    }
}
