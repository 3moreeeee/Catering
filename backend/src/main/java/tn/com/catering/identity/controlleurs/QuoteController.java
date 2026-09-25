package tn.com.catering.identity.controlleurs;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.QuoteResponse;
import tn.com.catering.identity.DTO.QuoteStatusRequest;
import tn.com.catering.identity.entities.QuoteStatus;
import tn.com.catering.identity.services.QuoteService;

@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    private final QuoteService quotes;

    public QuoteController(QuoteService quotes) {
        this.quotes = quotes;
    }

    @GetMapping("/me")
    List<QuoteResponse> mine(Principal principal) {
        return quotes.mine(UUID.fromString(principal.getName()));
    }

    /**
     * Readable by its owner and by any administrator. The distinction is passed
     * to the service, which decides; the controller does not gate it, so the
     * ownership rule lives in one place.
     */
    @GetMapping("/{id}")
    QuoteResponse byId(Authentication authentication, @PathVariable UUID id) {
        return quotes.byId(UUID.fromString(authentication.getName()), isAdmin(authentication), id);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    PageResponse<QuoteResponse> all(
            @RequestParam(required = false) QuoteStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return quotes.all(status, page, pageSize);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    QuoteResponse updateStatus(@PathVariable UUID id, @Valid @RequestBody QuoteStatusRequest request) {
        return quotes.updateStatus(id, request);
    }

    private static boolean isAdmin(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);
    }
}
