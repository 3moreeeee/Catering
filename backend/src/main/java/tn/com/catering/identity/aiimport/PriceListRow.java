package tn.com.catering.identity.aiimport;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One priced line of a company price list ("Liste des Couverts jetables 08 2022":
 * "FOURCHETTE EN BOIS · 0,090 · CARTON DE 1000 PCS").
 *
 * <p>The unit price is the PDF's own "prix unitaire (HT)", read by code and
 * stored exactly; the AI importer only chooses which row a photograph belongs
 * to, it never writes a price.
 */
@Entity
@Table(name = "price_list_rows", indexes = @Index(name = "idx_price_row_list", columnList = "list_name"))
public class PriceListRow {

    @Id
    @GeneratedValue
    private UUID id;

    /** The list's name without its date, so a newer edition replaces the older one. */
    @Column(name = "list_name", nullable = false, length = 160)
    private String listName;

    @Column(name = "source_file", nullable = false, length = 255)
    private String sourceFile;

    @Column(nullable = false)
    private int page;

    /** Position in the file, to keep the list's order. */
    @Column(nullable = false)
    private int position;

    @Column(length = 255)
    private String section;

    @Column(nullable = false, length = 500)
    private String name;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 3)
    private BigDecimal unitPrice;

    /** The price exactly as printed ("0,090"). */
    @Column(name = "price_text", nullable = false, length = 20)
    private String priceText;

    /** Packaging as printed ("CARTON DE 1000 PCS", "6 Boites"). */
    @Column(length = 255)
    private String packaging;

    /** Pieces per carton, when the packaging gives one. */
    @Column(name = "carton_quantity")
    private Integer cartonQuantity;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    protected PriceListRow() {}

    public PriceListRow(String listName, String sourceFile, int page, int position, String section, String name,
                        BigDecimal unitPrice, String priceText, String packaging, Integer cartonQuantity) {
        this.listName = listName;
        this.sourceFile = sourceFile;
        this.page = page;
        this.position = position;
        this.section = section;
        this.name = name;
        this.unitPrice = unitPrice;
        this.priceText = priceText;
        this.packaging = packaging;
        this.cartonQuantity = cartonQuantity;
        this.uploadedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getListName() { return listName; }
    public String getSourceFile() { return sourceFile; }
    public int getPage() { return page; }
    public int getPosition() { return position; }
    public String getSection() { return section; }
    public String getName() { return name; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public String getPriceText() { return priceText; }
    public String getPackaging() { return packaging; }
    public Integer getCartonQuantity() { return cartonQuantity; }
    public Instant getUploadedAt() { return uploadedAt; }

    /** One line for the reviewer and the model: list, section, name, price, packaging. */
    public String describe() {
        return listName + (section == null ? "" : " › " + section) + " — " + name + " — " + priceText + " TND HT"
                + (packaging == null || packaging.isBlank() ? "" : " — " + packaging);
    }
}
