package tn.com.catering.identity.services;

import java.util.UUID;
import tn.com.catering.identity.DTO.CartItemQuantityRequest;
import tn.com.catering.identity.DTO.CartItemRequest;
import tn.com.catering.identity.DTO.CartResponse;
import tn.com.catering.identity.DTO.QuoteResponse;
import tn.com.catering.identity.DTO.QuoteSubmitRequest;

/**
 * Every method takes the authenticated person's id and resolves that person's
 * own cart. There is deliberately no method that addresses a cart by its id, so
 * one client cannot reach another client's panier even by guessing.
 */
public interface CartService {

    CartResponse myCart(UUID personId);

    CartResponse addItem(UUID personId, CartItemRequest request);

    CartResponse updateItem(UUID personId, UUID itemId, CartItemQuantityRequest request);

    CartResponse removeItem(UUID personId, UUID itemId);

    CartResponse clear(UUID personId);

    /** Freezes the panier into a demande de devis and opens a fresh cart. */
    QuoteResponse submit(UUID personId, QuoteSubmitRequest request);
}
