package tn.com.catering.identity.entities;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * A submitted "demande de devis" - the site's conversion event.
 *
 * <p>Everything a commercial answer depends on is copied here at submit time:
 * the product names, the unit prices and the contact details. A later price
 * edit by an administrator must never rewrite what a customer was shown, so the
 * quote holds its own snapshot rather than re-reading the catalogue.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(
        name = "quotes",
        uniqueConstraints = @UniqueConstraint(name = "uk_quote_reference", columnNames = "reference"),
        indexes = {
            @Index(name = "idx_quote_person", columnList = "person_id"),
            @Index(name = "idx_quote_status", columnList = "status")
        })
public class Quote {

    @Id
    @GeneratedValue
    private UUID id;

    /** Human-readable identifier quoted in correspondence, e.g. DEV-2026-0001. */
    @Column(nullable = false, length = 32)
    private String reference;

    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Column(name = "contact_email", nullable = false, length = 254)
    private String contactEmail;

    @Column(name = "contact_name", length = 200)
    private String contactName;

    @Column(name = "company_name", length = 180)
    private String companyName;

    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    @Column(name = "delivery_city", length = 120)
    private String deliveryCity;

    @Column(length = 2000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private QuoteStatus status = QuoteStatus.SUBMITTED;

    /**
     * Direct order or quote request. Nullable at the column level so that
     * {@code ddl-auto: update} can add it to a table that already holds rows;
     * a null reads as {@link QuoteKind#QUOTE}, which is what every earlier row was.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private QuoteKind kind = QuoteKind.QUOTE;

    /** Sum of the priced lines at submit time. */
    @Column(name = "total_amount", precision = 12, scale = 3)
    private BigDecimal totalAmount;

    @Column(length = 3)
    private String currency;

    /** True when at least one line had no published price, so the total is partial. */
    @Column(name = "has_unpriced_lines", nullable = false)
    private boolean hasUnpricedLines;

    @Column(name = "admin_note", length = 2000)
    private String adminNote;

    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<QuoteLine> lines = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected Quote() {}

    public Quote(String reference, UUID personId, String contactEmail) {
        this.reference = reference;
        this.personId = personId;
        this.contactEmail = contactEmail;
    }

    public void addLine(QuoteLine line) {
        line.setQuote(this);
        lines.add(line);
    }

    public UUID getId() { return id; }
    public String getReference() { return reference; }
    public UUID getPersonId() { return personId; }
    public String getContactEmail() { return contactEmail; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public String getDeliveryCity() { return deliveryCity; }
    public void setDeliveryCity(String deliveryCity) { this.deliveryCity = deliveryCity; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public QuoteStatus getStatus() { return status; }
    public void setStatus(QuoteStatus status) { this.status = status; }
    public QuoteKind getKind() { return kind == null ? QuoteKind.QUOTE : kind; }
    public void setKind(QuoteKind kind) { this.kind = kind; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public boolean isHasUnpricedLines() { return hasUnpricedLines; }
    public void setHasUnpricedLines(boolean value) { this.hasUnpricedLines = value; }
    public String getAdminNote() { return adminNote; }
    public void setAdminNote(String adminNote) { this.adminNote = adminNote; }
    public List<QuoteLine> getLines() { return lines; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
