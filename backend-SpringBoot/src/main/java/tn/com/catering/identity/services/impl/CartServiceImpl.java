package tn.com.catering.identity.services.impl;

import java.time.Year;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.DTO.CartItemQuantityRequest;
import tn.com.catering.identity.DTO.CartItemRequest;
import tn.com.catering.identity.DTO.CartMapper;
import tn.com.catering.identity.DTO.CartResponse;
import tn.com.catering.identity.DTO.QuoteMapper;
import tn.com.catering.identity.DTO.QuoteResponse;
import tn.com.catering.identity.DTO.QuoteSubmitRequest;
import tn.com.catering.identity.common.ApiException;
import tn.com.catering.identity.entities.Cart;
import tn.com.catering.identity.entities.CartItem;
import tn.com.catering.identity.entities.CartStatus;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.entities.Quote;
import tn.com.catering.identity.entities.QuoteKind;
import tn.com.catering.identity.entities.QuoteLine;
import tn.com.catering.identity.person.Person;
import tn.com.catering.identity.person.PersonRepository;
import tn.com.catering.identity.repositories.CartRepository;
import tn.com.catering.identity.repositories.ProductRepository;
import tn.com.catering.identity.repositories.QuoteRepository;
import tn.com.catering.identity.services.CartService;

@Service
@Transactional
public class CartServiceImpl implements CartService {

    private static final String DEFAULT_CURRENCY = "TND";

    private final CartRepository carts;
    private final ProductRepository products;
    private final QuoteRepository quotes;
    private final PersonRepository people;
    private final CartMapper cartMapper;
    private final QuoteMapper quoteMapper;

    public CartServiceImpl(CartRepository carts, ProductRepository products, QuoteRepository quotes,
                           PersonRepository people, CartMapper cartMapper, QuoteMapper quoteMapper) {
        this.carts = carts;
        this.products = products;
        this.quotes = quotes;
        this.people = people;
        this.cartMapper = cartMapper;
        this.quoteMapper = quoteMapper;
    }

    @Override
    public CartResponse myCart(UUID personId) {
        Cart cart = openCart(personId);
        // Promotions can start or end while a cart is open. Refresh every line
        // when it is viewed so the displayed total always follows the current
        // catalogue offer rather than the price captured on first add.
        cart.getItems().forEach(CartItem::refreshPriceFromProduct);
        return cartMapper.toResponse(cart);
    }

    @Override
    public CartResponse addItem(UUID personId, CartItemRequest request) {
        Cart cart = openCart(personId);
        Product product = products.findById(request.productId())
                .filter(Product::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "product_not_found",
                        "Produit introuvable ou retiré du catalogue."));

        // Adding a product already in the panier increases the existing line
        // rather than creating a duplicate, which is what a buyer expects when
        // they add the same reference twice from different pages.
        cart.findItemForProduct(product.getId()).ifPresentOrElse(
                item -> {
                    item.setQuantity(item.getQuantity() + request.quantity());
                    if (request.formatValue() != null) item.setFormatValue(request.formatValue());
                    item.refreshPriceFromProduct();
                },
                () -> cart.addItem(new CartItem(product, request.quantity(), request.formatValue())));

        return cartMapper.toResponse(cart);
    }

    @Override
    public CartResponse updateItem(UUID personId, UUID itemId, CartItemQuantityRequest request) {
        Cart cart = openCart(personId);
        CartItem item = requireItem(cart, itemId);
        item.setQuantity(request.quantity());
        item.refreshPriceFromProduct();
        return cartMapper.toResponse(cart);
    }

    @Override
    public CartResponse removeItem(UUID personId, UUID itemId) {
        Cart cart = openCart(personId);
        cart.removeItem(requireItem(cart, itemId));
        return cartMapper.toResponse(cart);
    }

    @Override
    public CartResponse clear(UUID personId) {
        Cart cart = openCart(personId);
        cart.getItems().clear();
        return cartMapper.toResponse(cart);
    }

    @Override
    public QuoteResponse submit(UUID personId, QuoteSubmitRequest request) {
        Cart cart = openCart(personId);
        if (cart.getItems().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "cart_empty",
                    "Votre panier est vide : ajoutez au moins un produit avant de demander un devis.");
        }
        Person person = people.findById(personId).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "person_not_found", "Compte introuvable."));

        QuoteKind kind = request.kind() == null ? QuoteKind.QUOTE : request.kind();
        String contactPhone = firstNonBlank(request.contactPhone(), person.getPhone());
        String deliveryCity = firstNonBlank(request.deliveryCity(), null);
        if (kind == QuoteKind.ORDER) {
            // A direct order is bought at the displayed prices, so every line
            // needs one; an unpriced reference can only go through a quote.
            if (cart.hasUnpricedItems()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "order_unpriced",
                        "Certaines références n'ont pas de prix publié : demandez un devis.");
            }
            if (contactPhone == null || deliveryCity == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "order_contact_required",
                        "Un téléphone et une ville de livraison sont nécessaires pour commander.");
            }
        }

        Quote quote = new Quote(nextReference(kind), personId, person.getEmail());
        quote.setKind(kind);
        quote.setContactName(firstNonBlank(
                request.contactName(), joinName(person.getFirstName(), person.getLastName())));
        quote.setCompanyName(firstNonBlank(request.companyName(), person.getCompanyName()));
        quote.setContactPhone(contactPhone);
        quote.setDeliveryCity(deliveryCity);
        quote.setMessage(request.message());
        quote.setTotalAmount(cart.total());
        quote.setCurrency(DEFAULT_CURRENCY);
        quote.setHasUnpricedLines(cart.hasUnpricedItems());
        cart.getItems().forEach(item -> quote.addLine(new QuoteLine(item)));

        // The cart is retired rather than emptied, so the submitted document and
        // the panier that produced it stay separately auditable. The next
        // add-to-cart lazily opens a new one.
        cart.setStatus(CartStatus.CONVERTED);

        return quoteMapper.toResponse(quotes.save(quote));
    }

    // -------------------------------------------------------------------------

    /** Resolves the caller's open cart, creating one on first use. */
    private Cart openCart(UUID personId) {
        return carts.findByPersonIdAndStatus(personId, CartStatus.OPEN)
                .orElseGet(() -> carts.save(new Cart(personId)));
    }

    /**
     * Looks the line up inside the caller's own cart. An item id belonging to
     * someone else simply is not in this cart, so it reports 404 rather than
     * confirming the id exists.
     */
    private CartItem requireItem(Cart cart, UUID itemId) {
        return cart.getItems().stream()
                .filter(item -> item.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "cart_item_not_found",
                        "Cette ligne ne figure pas dans votre panier."));
    }

    /**
     * Sequential per-year reference, e.g. DEV-2026-0001.
     *
     * <p>Counting existing rows is adequate here because quotes are submitted at
     * human pace and the reference column is unique, so a genuine collision fails
     * the insert rather than producing two documents with the same number.
     */
    /** DEV-2026-0001 for a quote request, CMD-2026-0001 for a direct order. */
    private String nextReference(QuoteKind kind) {
        String prefix = (kind == QuoteKind.ORDER ? "CMD-" : "DEV-") + Year.now().getValue() + "-";
        long next = quotes.countByReferenceStartingWith(prefix) + 1;
        return prefix + String.format("%04d", next);
    }

    private static String joinName(String first, String last) {
        String joined = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
        return joined.isEmpty() ? null : joined;
    }

    private static String firstNonBlank(String preferred, String fallback) {
        return preferred != null && !preferred.isBlank() ? preferred.trim() : fallback;
    }
}
