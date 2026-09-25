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

@Entity
@Table(name = "product_images")
public class ProductImage {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 500)
    private String src;

    /** Alt text is mandatory in French; the site is accessibility-audited. */
    @Column(name = "alt_fr", nullable = false, length = 500)
    private String altFr;

    @Column(name = "alt_en", length = 500)
    private String altEn;

    private Integer width;

    private Integer height;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected ProductImage() {}

    public ProductImage(String src, String altFr, String altEn, Integer width, Integer height, int sortOrder) {
        this.src = src;
        this.altFr = altFr;
        this.altEn = altEn;
        this.width = width;
        this.height = height;
        this.sortOrder = sortOrder;
    }

    public UUID getId() { return id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public String getSrc() { return src; }
    public void setSrc(String src) { this.src = src; }
    public String getAltFr() { return altFr; }
    public void setAltFr(String altFr) { this.altFr = altFr; }
    public String getAltEn() { return altEn; }
    public void setAltEn(String altEn) { this.altEn = altEn; }
    public Integer getWidth() { return width; }
    public Integer getHeight() { return height; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
