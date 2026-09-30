package tn.com.catering.identity.entities;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** The pack price is exact millime arithmetic, never a floating-point approximation. */
class PackPriceTest {

    @ParameterizedTest
    @CsvSource({
            "0.120, 100, 12.000",
            "0.090, 250, 22.500",
            "0.125, 50, 6.250",
            "0.333, 100, 33.300",
            "0.001, 1, 0.001",
            "0.078, 100, 7.800",
            "3.353, 50, 167.650",
    })
    void unitPriceTimesPackQuantity(String unitPrice, int packQuantity, String expected) {
        BigDecimal packPrice = Product.packPrice(new BigDecimal(unitPrice), packQuantity);
        // toPlainString, not compareTo: the three decimals must be kept, so 12.000
        // is asserted as "12.000" and not merely as a value equal to 12.
        assertThat(packPrice.toPlainString()).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"0.120, ", ", 100"})
    void isUndefinedWithoutBothFactors(String unitPrice, Integer packQuantity) {
        assertThat(Product.packPrice(unitPrice == null ? null : new BigDecimal(unitPrice), packQuantity)).isNull();
    }
}
