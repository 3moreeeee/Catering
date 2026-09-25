package tn.com.catering.identity.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * One line of a panier.
 *
 * <p>{@code unitPrice} is refreshed from the product on every mutation of the
 * line, so an open cart always shows today's price. It is frozen only when the
 * cart is submitted, by copying it into a {@link QuoteLine}.
 */
@Entity
@Table(name = "cart_items")
public class CartItem {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cart_id", nullable = false)
    private Cart cart;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private int quantity;

    /** Null when the product carries no published price. */
    @Column(name = "unit_price", precision = 10, scale = 3)
    private BigDecimal unitPrice;

    @Column(name = "format_value", length = 160)
    private String formatValue;

    protected CartItem() {}

    public CartItem(Product product, int quantity, String formatValue) {
        this.product = product;
        this.quantity = quantity;
        this.formatValue = formatValue;
        this.unitPrice = product.effectivePrice();
    }

    /** Null when the line is unpriced, so it can be excluded from the total. */
    public BigDecimal lineTotal() {
        return unitPrice == null ? null : unitPrice.multiply(BigDecimal.valueOf(quantity));
    }

    public void refreshPriceFromProduct() {
        this.unitPrice = product.effectivePrice();
    }

    public UUID getId() { return id; }
    public Cart getCart() { return cart; }
    public void setCart(Cart cart) { this.cart = cart; }
    public Product getProduct() { return product; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public String getFormatValue() { return formatValue; }
    public void setFormatValue(String formatValue) { this.formatValue = formatValue; }
}
