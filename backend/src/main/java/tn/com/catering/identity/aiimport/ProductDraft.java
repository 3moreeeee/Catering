package tn.com.catering.identity.aiimport;

import java.util.List;

/** A model proposal after validation against the real taxonomy. Never carries a price. */
public record ProductDraft(
        String nameFr,
        String nameEn,
        String shortDescriptionFr,
        String shortDescriptionEn,
        String descriptionFr,
        String descriptionEn,
        String categoryId,
        String subcategoryId,
        String brandId,
        List<String> industries,
        String formatValue,
        Integer packQuantity,
        String unitLabel,
        /**
         * The model's verdict on whether the file name describes the product in
         * the photo. False only for a real contradiction (a "mushrooms" file that
         * shows sweet corn), not for an English name or a reference code. Null
         * when the model did not say.
         */
        Boolean fileNameMatches) {}
