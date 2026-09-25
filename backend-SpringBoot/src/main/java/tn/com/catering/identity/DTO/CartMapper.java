package tn.com.catering.identity.DTO;

import java.math.BigDecimal;
import org.springframework.stereotype.Component;
import tn.com.catering.identity.entities.Cart;
import tn.com.catering.identity.entities.CartItem;

@Component
public class CartMapper {

    private static final String DEFAULT_CURRENCY = "TND";

    private final ProductMapper products;

    public CartMapper(ProductMapper products) {
        this.products = products;
    }

    public CartResponse toResponse(Cart cart) {
        BigDecimal total = cart.total();
        return new CartResponse(
                cart.getId(),
                cart.getStatus().name(),
                cart.getItems().stream().map(this::toResponse).toList(),
                cart.getItems().size(),
                cart.getItems().stream().mapToInt(CartItem::getQuantity).sum(),
                total,
                currencyOf(cart),
                cart.hasUnpricedItems(),
                cart.getUpdatedAt());
    }

    public CartItemResponse toResponse(CartItem item) {
        return new CartItemResponse(
                item.getId(),
                item.getProduct().getId(),
                item.getProduct().getSlug(),
                LocalizedText.of(item.getProduct().getNameFr(), item.getProduct().getNameEn()),
                item.getProduct().getImages().stream().map(products::toResponse).toList(),
                item.getProduct().getSupplierReference(),
                item.getFormatValue(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.lineTotal(),
                item.getProduct().getCurrency());
    }

    /**
     * The cart has no currency column of its own. It takes the currency of its
     * first priced line, which is the only one that can differ from the default,
     * rather than asserting a currency for an empty or fully unpriced cart.
     */
    private String currencyOf(Cart cart) {
        return cart.getItems().stream()
                .filter(item -> item.getUnitPrice() != null)
                .map(item -> item.getProduct().getCurrency())
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(DEFAULT_CURRENCY);
    }
}
