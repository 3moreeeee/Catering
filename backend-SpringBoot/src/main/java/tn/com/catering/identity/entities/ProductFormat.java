package tn.com.catering.identity.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * A pack size or volume.
 *
 * <p>formatValue is a display string ("295 ml", "30x30 2 plis") rather than a
 * number/unit pair: the supplier data expresses formats inconsistently and
 * normalising it would invent precision the company has not supplied. The column
 * is not named "value" because that is a reserved word in H2.
 */
@Entity
@Table(name = "product_formats")
public class ProductFormat {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "external_id", length = 160)
    private String externalId;

    @Column(name = "format_value", nullable = false, length = 160)
    private String formatValue;

    @Column(name = "pack_quantity")
    private Integer packQuantity;

    @Column(name = "size_bucket", length = 20)
    private String sizeBucket;

    @Column(name = "format_reference", length = 120)
    private String formatReference;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected ProductFormat() {}

    public ProductFormat(String externalId, String formatValue, Integer packQuantity,
                         String sizeBucket, String formatReference, int sortOrder) {
        this.externalId = externalId;
        this.formatValue = formatValue;
        this.packQuantity = packQuantity;
        this.sizeBucket = sizeBucket;
        this.formatReference = formatReference;
        this.sortOrder = sortOrder;
    }

    public UUID getId() { return id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public String getExternalId() { return externalId; }
    public String getFormatValue() { return formatValue; }
    public Integer getPackQuantity() { return packQuantity; }
    public String getSizeBucket() { return sizeBucket; }
    public String getFormatReference() { return formatReference; }
    public int getSortOrder() { return sortOrder; }
}
