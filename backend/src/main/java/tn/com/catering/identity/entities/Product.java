package tn.com.catering.identity.entities;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * A catalogue reference.
 *
 * <p>Prices are numeric(10,3) because Tunisian dinars are quoted in millimes,
 * and nullable because the company has not supplied a price for every reference.
 * A null price is rendered as "prix sur demande" - it is never defaulted to
 * zero, which would read as "free" on the storefront.
 *
 * <p>categoryId, subcategoryId and brandId hold the stable external ids of
 * {@link Category} / {@link Brand} rather than foreign keys, so that reseeding
 * the taxonomy cannot orphan a product and so the JSON the API returns matches
 * the ids the Angular catalogue already filters on.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(
        name = "products",
        uniqueConstraints = {
            @UniqueConstraint(name = "uk_product_source_id", columnNames = "source_id"),
            @UniqueConstraint(name = "uk_product_slug", columnNames = "slug")
        },
        indexes = {
            @Index(name = "idx_product_category", columnList = "category_id"),
            @Index(name = "idx_product_brand", columnList = "brand_id"),
            @Index(name = "idx_product_active", columnList = "active")
        })
public class Product {

    @Id
    @GeneratedValue
    private UUID id;

    /** Stable catalogue key such as p-vinto-471. Survives reseeding; the UUID does not. */
    @Column(name = "source_id", nullable = false, length = 120)
    private String sourceId;

    @Column(nullable = false, length = 200)
    private String slug;

    @Column(name = "name_fr", nullable = false, length = 255)
    private String nameFr;

    @Column(name = "name_en", length = 255)
    private String nameEn;

    @Column(name = "short_description_fr", length = 1000)
    private String shortDescriptionFr;

    @Column(name = "short_description_en", length = 1000)
    private String shortDescriptionEn;

    @Column(name = "description_fr", length = 4000)
    private String descriptionFr;

    @Column(name = "description_en", length = 4000)
    private String descriptionEn;

    @Column(name = "category_id", nullable = false, length = 80)
    private String categoryId;

    @Column(name = "subcategory_id", length = 80)
    private String subcategoryId;

    @Column(name = "brand_id", length = 80)
    private String brandId;

    @ElementCollection
    @CollectionTable(
            name = "product_industries",
            joinColumns = @JoinColumn(name = "product_id"),
            foreignKey = @ForeignKey(name = "fk_product_industry"))
    @Column(name = "industry_id", length = 80)
    private Set<String> industries = new LinkedHashSet<>();

    /** Null when the company has published no price. Never defaulted. */
    @Column(precision = 10, scale = 3)
    private BigDecimal price;

    @Column(length = 3)
    private String currency;

    /** Optional promotional price managed independently from the catalogue price. */
    @Column(name = "offer_price", precision = 10, scale = 3)
    private BigDecimal offerPrice;

    @Column(name = "offer_starts_at")
    private Instant offerStartsAt;

    @Column(name = "offer_ends_at")
    private Instant offerEndsAt;

    @Column(name = "offer_active", nullable = false)
    private boolean offerActive = false;

    @Column(name = "stock_quantity")
    private Integer stockQuantity;

    @Column(name = "supplier_reference", length = 120)
    private String supplierReference;

    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    @Column(name = "technical_sheet_url", length = 500)
    private String technicalSheetUrl;

    @Column(nullable = false)
    private boolean featured = false;

    /** Soft delete. Deactivated products stay addressable by past quotes. */
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "needs_verification", nullable = false)
    private boolean needsVerification = false;

    @Column(name = "seo_title_fr", length = 255)
    private String seoTitleFr;

    @Column(name = "seo_title_en", length = 255)
    private String seoTitleEn;

    @Column(name = "seo_description_fr", length = 1000)
    private String seoDescriptionFr;

    @Column(name = "seo_description_en", length = 1000)
    private String seoDescriptionEn;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder asc")
    private List<ProductImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder asc")
    private List<ProductFormat> formats = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected Product() {}

    public Product(String sourceId, String slug, String nameFr, String categoryId) {
        this.sourceId = sourceId;
        this.slug = slug;
        this.nameFr = nameFr;
        this.categoryId = categoryId;
    }

    public void addImage(ProductImage image) {
        image.setProduct(this);
        images.add(image);
    }

    public void addFormat(ProductFormat format) {
        format.setProduct(this);
        formats.add(format);
    }

    public void clearImages() { images.clear(); }

    public void clearFormats() { formats.clear(); }

    public UUID getId() { return id; }
    public String getSourceId() { return sourceId; }
    public void setSourceId(String sourceId) { this.sourceId = sourceId; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getNameFr() { return nameFr; }
    public void setNameFr(String nameFr) { this.nameFr = nameFr; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getShortDescriptionFr() { return shortDescriptionFr; }
    public void setShortDescriptionFr(String value) { this.shortDescriptionFr = value; }
    public String getShortDescriptionEn() { return shortDescriptionEn; }
    public void setShortDescriptionEn(String value) { this.shortDescriptionEn = value; }
    public String getDescriptionFr() { return descriptionFr; }
    public void setDescriptionFr(String value) { this.descriptionFr = value; }
    public String getDescriptionEn() { return descriptionEn; }
    public void setDescriptionEn(String value) { this.descriptionEn = value; }
    public String getCategoryId() { return categoryId; }
    public void setCategoryId(String categoryId) { this.categoryId = categoryId; }
    public String getSubcategoryId() { return subcategoryId; }
    public void setSubcategoryId(String subcategoryId) { this.subcategoryId = subcategoryId; }
    public String getBrandId() { return brandId; }
    public void setBrandId(String brandId) { this.brandId = brandId; }
    public Set<String> getIndustries() { return industries; }
    public void setIndustries(Set<String> industries) { this.industries = industries; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public BigDecimal getOfferPrice() { return offerPrice; }
    public void setOfferPrice(BigDecimal value) { this.offerPrice = value; }
    public Instant getOfferStartsAt() { return offerStartsAt; }
    public void setOfferStartsAt(Instant value) { this.offerStartsAt = value; }
    public Instant getOfferEndsAt() { return offerEndsAt; }
    public void setOfferEndsAt(Instant value) { this.offerEndsAt = value; }
    public boolean isOfferActive() { return offerActive; }
    public void setOfferActive(boolean value) { this.offerActive = value; }
    public boolean hasCurrentOffer() {
        Instant now = Instant.now();
        return offerActive && offerPrice != null && price != null
                && offerPrice.compareTo(price) < 0
                && (offerStartsAt == null || !now.isBefore(offerStartsAt))
                && (offerEndsAt == null || now.isBefore(offerEndsAt));
    }
    public BigDecimal effectivePrice() { return hasCurrentOffer() ? offerPrice : price; }
    public Integer getStockQuantity() { return stockQuantity; }
    public void setStockQuantity(Integer stockQuantity) { this.stockQuantity = stockQuantity; }
    public String getSupplierReference() { return supplierReference; }
    public void setSupplierReference(String value) { this.supplierReference = value; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getTechnicalSheetUrl() { return technicalSheetUrl; }
    public void setTechnicalSheetUrl(String value) { this.technicalSheetUrl = value; }
    public boolean isFeatured() { return featured; }
    public void setFeatured(boolean featured) { this.featured = featured; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isNeedsVerification() { return needsVerification; }
    public void setNeedsVerification(boolean value) { this.needsVerification = value; }
    public String getSeoTitleFr() { return seoTitleFr; }
    public void setSeoTitleFr(String value) { this.seoTitleFr = value; }
    public String getSeoTitleEn() { return seoTitleEn; }
    public void setSeoTitleEn(String value) { this.seoTitleEn = value; }
    public String getSeoDescriptionFr() { return seoDescriptionFr; }
    public void setSeoDescriptionFr(String value) { this.seoDescriptionFr = value; }
    public String getSeoDescriptionEn() { return seoDescriptionEn; }
    public void setSeoDescriptionEn(String value) { this.seoDescriptionEn = value; }
    public List<ProductImage> getImages() { return images; }
    public List<ProductFormat> getFormats() { return formats; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
