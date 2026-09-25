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
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * A panier belonging to one person.
 *
 * <p>The owner is held as a plain {@code personId} rather than an association,
 * mirroring how the identity module keeps its aggregate boundary: the catalogue
 * side never navigates into a Person, it only checks the id against the
 * authenticated principal.
 *
 * <p>There is no order or payment counterpart by design. The only exit from a
 * cart is {@link Quote}, a request for a commercial offer.
 */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(
        name = "carts",
        indexes = @Index(name = "idx_cart_person_status", columnList = "person_id, status"))
public class Cart {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CartStatus status = CartStatus.OPEN;

    @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CartItem> items = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected Cart() {}

    public Cart(UUID personId) {
        this.personId = personId;
    }

    public void addItem(CartItem item) {
        item.setCart(this);
        items.add(item);
    }

    public void removeItem(CartItem item) {
        items.remove(item);
        item.setCart(null);
    }

    public Optional<CartItem> findItemForProduct(UUID productId) {
        return items.stream().filter(item -> item.getProduct().getId().equals(productId)).findFirst();
    }

    /**
     * Sum of the priced lines only.
     *
     * <p>Lines whose product carries no price contribute nothing rather than
     * zero-rating the request; the API reports them separately so the storefront
     * can say the total is partial and awaiting a quote.
     */
    public BigDecimal total() {
        return items.stream()
                .map(CartItem::lineTotal)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public boolean hasUnpricedItems() {
        return items.stream().anyMatch(item -> item.getUnitPrice() == null);
    }

    public UUID getId() { return id; }
    public UUID getPersonId() { return personId; }
    public CartStatus getStatus() { return status; }
    public void setStatus(CartStatus status) { this.status = status; }
    public List<CartItem> getItems() { return items; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
