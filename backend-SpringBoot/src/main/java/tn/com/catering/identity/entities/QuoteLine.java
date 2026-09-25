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
 * A frozen line of a submitted quote.
 *
 * <p>The product name and unit price are stored as columns, not read through the
 * association, so the document stays truthful after the catalogue changes. The
 * {@code product} link is kept nullable and for reference only - a product may
 * later be deactivated, and that must not invalidate historical quotes.
 */
@Entity
@Table(name = "quote_lines")
public class QuoteLine {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quote_id", nullable = false)
    private Quote quote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(name = "product_source_id", nullable = false, length = 120)
    private String productSourceId;

    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(name = "supplier_reference", length = 120)
    private String supplierReference;

    @Column(name = "format_value", length = 160)
    private String formatValue;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "unit_price", precision = 10, scale = 3)
    private BigDecimal unitPrice;

    @Column(name = "line_total", precision = 12, scale = 3)
    private BigDecimal lineTotal;

    protected QuoteLine() {}

    public QuoteLine(CartItem item) {
        this.product = item.getProduct();
        this.productSourceId = item.getProduct().getSourceId();
        this.productName = item.getProduct().getNameFr();
        this.supplierReference = item.getProduct().getSupplierReference();
        this.formatValue = item.getFormatValue();
        this.quantity = item.getQuantity();
        this.unitPrice = item.getUnitPrice();
        this.lineTotal = item.lineTotal();
    }

    public UUID getId() { return id; }
    public Quote getQuote() { return quote; }
    public void setQuote(Quote quote) { this.quote = quote; }
    public Product getProduct() { return product; }
    public String getProductSourceId() { return productSourceId; }
    public String getProductName() { return productName; }
    public String getSupplierReference() { return supplierReference; }
    public String getFormatValue() { return formatValue; }
    public int getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public BigDecimal getLineTotal() { return lineTotal; }
}
