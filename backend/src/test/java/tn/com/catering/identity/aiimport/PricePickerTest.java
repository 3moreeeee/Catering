package tn.com.catering.identity.aiimport;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import tn.com.catering.identity.entities.SaleMode;

class PricePickerTest {

    private final PricePicker picker = new PricePicker(new ObjectMapper());

    private static PriceListRow row(String list, String name, String price, String packaging, Integer carton) {
        return new PriceListRow(list, list + ".pdf", 1, 0, null, name,
                new BigDecimal(price.replace(',', '.')), price, packaging, carton);
    }

    private final PriceListRow woodFork = row("Couverts", "FOURCHETTE EN BOIS", "0,090", "CARTON DE 1000 PCS", 1000);
    private final PriceListRow woodKnife = row("Couverts", "COUTEAU EN BOIS", "0,090", "CARTON DE 1000 PCS", 1000);
    private final PriceListRow plasticFork = row("Couverts", "FOURCHETTE EN PLASTIQUE TRANSPARENT", "0,070", "CARTON DE 2000 PCS", 2000);
    private final PriceListRow strawberry = row("Monin", "Sirop de Fraise 1L", "31,938", null, 6);
    private final PriceListRow pump = row("Monin", "Pompe 10ml pour sirop 1L", "9,900", null, 1);

    @Test
    void ranksTheRowsClosestToTheProductFirst() {
        List<PriceListRow> rows = List.of(woodKnife, plasticFork, strawberry, pump, woodFork);
        assertThat(picker.candidates(rows, "Fourchette en bois - les 100", null)).first().isEqualTo(woodFork);
        assertThat(picker.candidates(rows, "Pompe à sirop MONIN 1L", "1L POMPE SIROP MONIN")).first().isEqualTo(pump);
        assertThat(picker.candidates(rows, "Sirop de fraise MONIN 1L")).first().isEqualTo(strawberry);
        assertThat(picker.candidates(rows, "Gant nitrile")).isEmpty();
        PriceListRow hazelnut = row("Monin", "Sirop Noisettes grillées 70cl", "29,000", null, 6);
        assertThat(picker.candidates(List.of(strawberry, hazelnut), "SIROP NOISETTE GRILLEE")).first().isEqualTo(hazelnut);
    }

    @Test
    void aPricePerPieceBecomesALotOfTheSizeNamedInTheProduct() {
        PricePicker.Suggestion lot = picker.price(woodFork, new PricePicker.Choice(0, false, "piece", null),
                null, "Fourchette en bois - LES 100 PIÈCES");
        assertThat(lot.saleMode()).isEqualTo(SaleMode.PACK_ONLY);
        assertThat(lot.price()).isEqualByComparingTo("0.090");
        assertThat(lot.lotQuantity()).isEqualTo(100);
        assertThat(lot.note()).isNull();
    }

    @Test
    void withoutALotInTheNameTheCartonIsProposedAndABigOneIsFlagged() {
        PricePicker.Suggestion syrup = picker.price(strawberry, new PricePicker.Choice(0, false, "bouteille", null),
                null, "Sirop de fraise MONIN 1L");
        assertThat(syrup.lotQuantity()).isEqualTo(6);
        assertThat(syrup.unitLabel()).isEqualTo("bouteille");
        assertThat(syrup.note()).isNull();

        PricePicker.Suggestion forks = picker.price(woodFork, new PricePicker.Choice(0, false, "piece", null),
                null, "Fourchette en bois");
        assertThat(forks.lotQuantity()).isEqualTo(1000);
        assertThat(forks.note()).contains("carton complet");

        PricePicker.Suggestion single = picker.price(pump, new PricePicker.Choice(0, false, "piece", null),
                null, "Pompe sirop");
        assertThat(single.saleMode()).isEqualTo(SaleMode.UNIT);
        assertThat(single.price()).isEqualByComparingTo("9.900");
    }

    @Test
    void aPriceForThePackagingIsDividedOnlyWhenItFallsOnWholeMillimes() {
        PriceListRow bags = row("Pâtisserie", "POCHE ROULEAU 55 CM", "53,000", "100 PIECES", 100);
        PricePicker.Suggestion perBag = picker.price(bags, new PricePicker.Choice(0, true, "piece", null), null, "Poche");
        assertThat(perBag.saleMode()).isEqualTo(SaleMode.PACK_ONLY);
        assertThat(perBag.price()).isEqualByComparingTo("0.530");
        assertThat(perBag.lotQuantity()).isEqualTo(100);

        PriceListRow cups = row("Pâtisserie", "CAISSETTE N °5 BLANC", "5,500", "1000 PIECES", 1000);
        PricePicker.Suggestion perPack = picker.price(cups, new PricePicker.Choice(0, true, "piece", null), null, "Caissette");
        assertThat(perPack.saleMode()).isEqualTo(SaleMode.UNIT);
        assertThat(perPack.price()).isEqualByComparingTo("5.500");
        assertThat(perPack.lotQuantity()).isEqualTo(1000);
    }

    /** The two real misses of the first ten-photo run: the model read packet prices as piece prices. */
    @Test
    void aPacketPriceIsRecognisedEvenWhenTheModelSaysPerPiece() {
        PriceListRow picks = row("Piques", "Pics boule rouge 3cm x 12cm", "14,000", "100", 100);
        PricePicker.Suggestion pick = picker.price(picks, new PricePicker.Choice(0, false, "pique", null),
                100, "pick_boule_rouge_100");
        assertThat(pick.saleMode()).isEqualTo(SaleMode.PACK_ONLY);
        assertThat(pick.price()).isEqualByComparingTo("0.140");
        assertThat(pick.lotQuantity()).isEqualTo(100);

        PriceListRow doilies = row("Pâtisserie", "PAPIER DENTELLE DIAM 190MM", "39,000", "1000 PIECES", 1000);
        PricePicker.Suggestion doily = picker.price(doilies, new PricePicker.Choice(0, false, "piece", null),
                null, "DENTELLE_ROND_190_DE_250");
        assertThat(doily.price()).isEqualByComparingTo("0.039");
        assertThat(doily.lotQuantity()).isEqualTo(250);

        PriceListRow glass = row("Polycarbonate", "Verre en polycarbonate 250ml", "3,353", null, 50);
        assertThat(PricePicker.isPackPrice(glass)).isFalse();

        // The 20-photo run: "Toque Master Chef · 3,000 · 10 PIECES" read as a packet price.
        PriceListRow toque = row("Hygiène", "Toque Master Chef", "3,000", "10 PIECES", 10);
        PricePicker.Suggestion hat = picker.price(toque, new PricePicker.Choice(0, true, "piece", null), null, "toque");
        assertThat(hat.price()).isEqualByComparingTo("3.000");
        assertThat(hat.lotQuantity()).isEqualTo(10);

        // The third miss: "3,500 · 6 Boites" read as a packet price, though 3,500 / 6 is not whole millimes.
        PriceListRow film = row("Film", "Film étirable sans Boite Distributrice, largeur 30cm, longueur 50 mètres",
                "3,500", "6 Boites", 6);
        PricePicker.Suggestion roll = picker.price(film, new PricePicker.Choice(0, true, "boite", null), null, "FILM");
        assertThat(roll.saleMode()).isEqualTo(SaleMode.PACK_ONLY);
        assertThat(roll.price()).isEqualByComparingTo("3.500");
        assertThat(roll.lotQuantity()).isEqualTo(6);
    }

    @Test
    void readsOnlyAValidChoice() {
        assertThat(picker.parseChoice("{\"choice\": 2, \"priceFor\": \"packaging\", \"unitLabel\": \"Boite\"}", 3))
                .get().satisfies(choice -> {
                    assertThat(choice.index()).isEqualTo(1);
                    assertThat(choice.priceForPackaging()).isTrue();
                    assertThat(choice.unitLabel()).isEqualTo("boite");
                });
        assertThat(picker.parseChoice("{\"choice\": null}", 3)).isEmpty();
        assertThat(picker.parseChoice("{\"choice\": 9}", 3)).isEmpty();
        assertThat(picker.parseChoice("pas de json", 3)).isEmpty();
    }
}
