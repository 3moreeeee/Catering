package tn.com.catering.identity.controlleurs;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.com.catering.identity.DTO.CartItemQuantityRequest;
import tn.com.catering.identity.DTO.CartItemRequest;
import tn.com.catering.identity.DTO.CartResponse;
import tn.com.catering.identity.DTO.QuoteResponse;
import tn.com.catering.identity.DTO.QuoteSubmitRequest;
import tn.com.catering.identity.services.CartService;

/**
 * The panier of the authenticated caller.
 *
 * <p>No route takes a cart id: the cart is always resolved from the principal,
 * which is what makes cross-account access impossible rather than merely denied.
 * Principal.getName() carries the person UUID, as set by the JWT filter.
 *
 * <p>Available to clients and administrators. Administrators can therefore
 * verify the exact buying journey and prepare a quote from the catalogue.
 */
@RestController
@RequestMapping("/api/cart")
@PreAuthorize("hasAnyRole('CLIENT', 'ADMIN')")
public class CartController {

    private final CartService carts;

    public CartController(CartService carts) {
        this.carts = carts;
    }

    @GetMapping
    CartResponse myCart(Principal principal) {
        return carts.myCart(personId(principal));
    }

    @PostMapping("/items")
    CartResponse addItem(Principal principal, @Valid @RequestBody CartItemRequest request) {
        return carts.addItem(personId(principal), request);
    }

    @PutMapping("/items/{itemId}")
    CartResponse updateItem(Principal principal, @PathVariable UUID itemId,
                            @Valid @RequestBody CartItemQuantityRequest request) {
        return carts.updateItem(personId(principal), itemId, request);
    }

    @DeleteMapping("/items/{itemId}")
    CartResponse removeItem(Principal principal, @PathVariable UUID itemId) {
        return carts.removeItem(personId(principal), itemId);
    }

    @DeleteMapping
    CartResponse clear(Principal principal) {
        return carts.clear(personId(principal));
    }

    /** Converts the panier into an order or a demande de devis. No payment is taken. */
    @PostMapping("/submit")
    ResponseEntity<QuoteResponse> submit(Principal principal, @Valid @RequestBody QuoteSubmitRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(carts.submit(personId(principal), request));
    }

    private static UUID personId(Principal principal) {
        return UUID.fromString(principal.getName());
    }
}
