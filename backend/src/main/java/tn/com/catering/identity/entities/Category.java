package tn.com.catering.identity.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;

/**
 * A commercial universe ("food", "monin") or one of its subcategories.
 *
 * Parent/child is expressed by {@code parentExternalId} rather than a
 * self-referencing association because the taxonomy is two levels deep and flat,
 * and the frontend addresses categories by their stable external id.
 */
@Entity
@Table(
        name = "categories",
        uniqueConstraints = {
            @UniqueConstraint(name = "uk_category_external_id", columnNames = "external_id"),
            @UniqueConstraint(name = "uk_category_slug", columnNames = "slug")
        })
public class Category {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "external_id", nullable = false, length = 80)
    private String externalId;

    @Column(nullable = false, length = 160)
    private String slug;

    @Column(name = "name_fr", nullable = false, length = 180)
    private String nameFr;

    @Column(name = "name_en", length = 180)
    private String nameEn;

    @Column(name = "parent_external_id", length = 80)
    private String parentExternalId;

    @Column(length = 16)
    private String accent;

    @Column(length = 255)
    private String image;

    @Column(length = 255)
    private String icon;

    protected Category() {}

    public Category(String externalId, String slug, String nameFr) {
        this.externalId = externalId;
        this.slug = slug;
        this.nameFr = nameFr;
    }

    public UUID getId() { return id; }
    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getNameFr() { return nameFr; }
    public void setNameFr(String nameFr) { this.nameFr = nameFr; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getParentExternalId() { return parentExternalId; }
    public void setParentExternalId(String parentExternalId) { this.parentExternalId = parentExternalId; }
    public String getAccent() { return accent; }
    public void setAccent(String accent) { this.accent = accent; }
    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
}
