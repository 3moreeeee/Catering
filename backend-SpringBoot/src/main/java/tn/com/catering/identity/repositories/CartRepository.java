package tn.com.catering.identity.repositories;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import tn.com.catering.identity.entities.Cart;
import tn.com.catering.identity.entities.CartStatus;

public interface CartRepository extends JpaRepository<Cart, UUID> {
    Optional<Cart> findByPersonIdAndStatus(UUID personId, CartStatus status);
}
