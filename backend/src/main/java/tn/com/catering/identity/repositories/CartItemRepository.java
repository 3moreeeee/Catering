package tn.com.catering.identity.repositories;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import tn.com.catering.identity.entities.CartItem;

public interface CartItemRepository extends JpaRepository<CartItem, UUID> {
}
