package tn.com.catering.identity.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;

@Entity
@Table(
        name = "brands",
        uniqueConstraints = {
            @UniqueConstraint(name = "uk_brand_external_id", columnNames = "external_id"),
            @UniqueConstraint(name = "uk_brand_slug", columnNames = "slug")
        })
public class Brand {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "external_id", nullable = false, length = 80)
    private String externalId;

    @Column(nullable = false, length = 160)
    private String slug;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(length = 255)
    private String logo;

    @Column(name = "description_fr", length = 2000)
    private String descriptionFr;

    @Column(name = "description_en", length = 2000)
    private String descriptionEn;

    @Column(length = 255)
    private String website;

    protected Brand() {}

    public Brand(String externalId, String slug, String name) {
        this.externalId = externalId;
        this.slug = slug;
        this.name = name;
    }

    public UUID getId() { return id; }
    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getLogo() { return logo; }
    public void setLogo(String logo) { this.logo = logo; }
    public String getDescriptionFr() { return descriptionFr; }
    public void setDescriptionFr(String descriptionFr) { this.descriptionFr = descriptionFr; }
    public String getDescriptionEn() { return descriptionEn; }
    public void setDescriptionEn(String descriptionEn) { this.descriptionEn = descriptionEn; }
    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }
}
