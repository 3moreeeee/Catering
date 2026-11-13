package tn.com.catering.identity.aiimport;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * One photograph going through the AI importer, and the product the model
 * proposed for it.
 *
 * <p>The proposal lives here, not in {@code products}, until an administrator
 * publishes it with a price. The public catalogue therefore never sees an
 * unreviewed or unpriced AI draft, and discarding a proposal leaves no trace in
 * the product table.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "product_import_items", indexes = {
        @Index(name = "idx_import_status", columnList = "status"),
        @Index(name = "idx_import_created", columnList = "created_at")
})
public class ProductImportItem {

    public enum Status { QUEUED, PROCESSING, READY, FAILED, PUBLISHED, DISCARDED }

    /** CREATE adds a new product; REPLACE_IMAGE swaps the photograph of an existing one. */
    public enum Action { CREATE, REPLACE_IMAGE }

    @Id
    @GeneratedValue
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.QUEUED;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Action action;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    /** The photograph as uploaded to ImageKit. */
    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    /** The URL stored on the product: the original with the background-removal transformation. */
    @Column(name = "display_url", nullable = false, length = 500)
    private String displayUrl;

    @Column(name = "image_width")
    private Integer imageWidth;

    @Column(name = "image_height")
    private Integer imageHeight;

    @Column(name = "name_fr", length = 255)
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

    @Column(name = "category_id", length = 80)
    private String categoryId;

    @Column(name = "subcategory_id", length = 80)
    private String subcategoryId;

    @Column(name = "brand_id", length = 80)
    private String brandId;

    /** Comma-separated industry ids; a short, closed list. */
    @Column(length = 255)
    private String industries;

    @Column(name = "format_value", length = 160)
    private String formatValue;

    @Column(name = "pack_quantity")
    private Integer packQuantity;

    @Column(name = "unit_label", length = 20)
    private String unitLabel;

    @Column(name = "matched_product_id")
    private UUID matchedProductId;

    @Column(name = "matched_product_name", length = 255)
    private String matchedProductName;

    @Column(name = "match_score")
    private Double matchScore;

    @Column(name = "published_product_id")
    private UUID publishedProductId;

    @Column(length = 120)
    private String model;

    @Column(length = 1000)
    private String error;

    /** Something the reviewer must check, e.g. a file name that contradicts the label in the photo. */
    @Column(length = 500)
    private String warning;

    /** The price-list row the price was taken from, as shown to the reviewer. */
    @Column(name = "price_source", length = 600)
    private String priceSource;

    /** How the price was derived, or why none was found. */
    @Column(name = "price_note", length = 500)
    private String priceNote;

    @Column(name = "suggested_sale_mode", length = 20)
    private String suggestedSaleMode;

    /** The unit price for PACK_ONLY, the price of one lot for UNIT. Copied from the price list, never computed by the model. */
    @Column(name = "suggested_price", precision = 10, scale = 3)
    private java.math.BigDecimal suggestedPrice;

    @Column(nullable = false)
    private int attempts;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected ProductImportItem() {}

    public ProductImportItem(String originalFilename, String imageUrl, String displayUrl,
                             Integer imageWidth, Integer imageHeight) {
        this.originalFilename = originalFilename;
        this.imageUrl = imageUrl;
        this.displayUrl = displayUrl;
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;
    }

    /** Copies a validated model proposal onto this item. */
    public void applyDraft(ProductDraft draft) {
        nameFr = draft.nameFr();
        nameEn = draft.nameEn();
        shortDescriptionFr = draft.shortDescriptionFr();
        shortDescriptionEn = draft.shortDescriptionEn();
        descriptionFr = draft.descriptionFr();
        descriptionEn = draft.descriptionEn();
        categoryId = draft.categoryId();
        subcategoryId = draft.subcategoryId();
        brandId = draft.brandId();
        industries = String.join(",", draft.industries());
        formatValue = draft.formatValue();
        packQuantity = draft.packQuantity();
        unitLabel = draft.unitLabel();
    }

    public UUID getId() { return id; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Action getAction() { return action; }
    public void setAction(Action action) { this.action = action; }
    public String getOriginalFilename() { return originalFilename; }
    public String getImageUrl() { return imageUrl; }
    public String getDisplayUrl() { return displayUrl; }
    public Integer getImageWidth() { return imageWidth; }
    public Integer getImageHeight() { return imageHeight; }
    public String getNameFr() { return nameFr; }
    public void setNameFr(String value) { this.nameFr = value; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String value) { this.nameEn = value; }
    public String getShortDescriptionFr() { return shortDescriptionFr; }
    public void setShortDescriptionFr(String value) { this.shortDescriptionFr = value; }
    public String getShortDescriptionEn() { return shortDescriptionEn; }
    public void setShortDescriptionEn(String value) { this.shortDescriptionEn = value; }
    public String getDescriptionFr() { return descriptionFr; }
    public void setDescriptionFr(String value) { this.descriptionFr = value; }
    public String getDescriptionEn() { return descriptionEn; }
    public void setDescriptionEn(String value) { this.descriptionEn = value; }
    public String getCategoryId() { return categoryId; }
    public void setCategoryId(String value) { this.categoryId = value; }
    public String getSubcategoryId() { return subcategoryId; }
    public void setSubcategoryId(String value) { this.subcategoryId = value; }
    public String getBrandId() { return brandId; }
    public void setBrandId(String value) { this.brandId = value; }
    public String getIndustries() { return industries; }
    public void setIndustries(String value) { this.industries = value; }
    public String getFormatValue() { return formatValue; }
    public void setFormatValue(String value) { this.formatValue = value; }
    public Integer getPackQuantity() { return packQuantity; }
    public void setPackQuantity(Integer value) { this.packQuantity = value; }
    public String getUnitLabel() { return unitLabel; }
    public void setUnitLabel(String value) { this.unitLabel = value; }
    public UUID getMatchedProductId() { return matchedProductId; }
    public void setMatchedProductId(UUID value) { this.matchedProductId = value; }
    public String getMatchedProductName() { return matchedProductName; }
    public void setMatchedProductName(String value) { this.matchedProductName = value; }
    public Double getMatchScore() { return matchScore; }
    public void setMatchScore(Double value) { this.matchScore = value; }
    public UUID getPublishedProductId() { return publishedProductId; }
    public void setPublishedProductId(UUID value) { this.publishedProductId = value; }
    public String getModel() { return model; }
    public void setModel(String value) { this.model = value; }
    public String getError() { return error; }
    public void setError(String value) { this.error = value == null ? null : value.length() > 1000 ? value.substring(0, 1000) : value; }
    public String getPriceSource() { return priceSource; }
    public String getPriceNote() { return priceNote; }
    public String getSuggestedSaleMode() { return suggestedSaleMode; }
    public java.math.BigDecimal getSuggestedPrice() { return suggestedPrice; }

    /** Records the price found in the price lists, or clears it with the reason none was found. */
    public void applyPrice(String source, String saleMode, java.math.BigDecimal price, String note) {
        this.priceSource = source == null ? null : source.length() > 600 ? source.substring(0, 600) : source;
        this.suggestedSaleMode = saleMode;
        this.suggestedPrice = price;
        this.priceNote = note == null ? null : note.length() > 500 ? note.substring(0, 500) : note;
    }

    public String getWarning() { return warning; }
    public void setWarning(String value) { this.warning = value == null ? null : value.length() > 500 ? value.substring(0, 500) : value; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int value) { this.attempts = value; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
