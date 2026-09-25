package tn.com.catering.identity.DTO;

/**
 * A bilingual string. The site is FR/EN and copy is never baked into assets, so
 * every human-readable field crosses the API as a pair rather than as whichever
 * language the request happened to ask for.
 */
public record LocalizedText(String fr, String en) {

    public static LocalizedText of(String fr, String en) {
        if (fr == null && en == null) return null;
        return new LocalizedText(fr, en == null ? fr : en);
    }
}
