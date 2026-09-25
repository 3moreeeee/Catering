package tn.com.catering.identity.person;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tn.com.catering.identity.person.dto.AdminCreatePersonRequest;
import tn.com.catering.identity.person.dto.AdminUpdatePersonRequest;
import tn.com.catering.identity.person.dto.ChangePasswordRequest;
import tn.com.catering.identity.person.dto.PersonResponse;
import tn.com.catering.identity.person.dto.UpdateProfileRequest;
import tn.com.catering.identity.security.SessionCookieService;

@RestController
@RequestMapping("/api/persons")
public class PersonController {
    private final PersonService people;
    private final SessionCookieService cookies;

    public PersonController(PersonService people, SessionCookieService cookies) {
        this.people = people;
        this.cookies = cookies;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    List<PersonResponse> list(@RequestParam(defaultValue = "") String q) {
        return people.list(q);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<PersonResponse> create(@Valid @RequestBody AdminCreatePersonRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(PersonResponse.from(people.createByAdmin(request)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    PersonResponse get(@PathVariable UUID id) {
        return PersonResponse.from(people.byId(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    PersonResponse update(Principal principal, @PathVariable UUID id, @Valid @RequestBody AdminUpdatePersonRequest request) {
        return PersonResponse.from(people.updateByAdmin(UUID.fromString(principal.getName()), id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    ResponseEntity<Void> delete(Principal principal, @PathVariable UUID id) {
        people.deleteByAdmin(UUID.fromString(principal.getName()), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/me")
    PersonResponse updateMe(Principal principal, @Valid @RequestBody UpdateProfileRequest request) {
        return PersonResponse.from(people.updateSelf(UUID.fromString(principal.getName()), request));
    }

    @PutMapping("/me/password")
    ResponseEntity<Void> changePassword(Principal principal, @Valid @RequestBody ChangePasswordRequest request) {
        people.changePassword(UUID.fromString(principal.getName()), request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me")
    ResponseEntity<Void> deleteMe(Principal principal, HttpServletResponse response) {
        people.deleteSelf(UUID.fromString(principal.getName()));
        response.addHeader(cookies.headerName(), cookies.cleared());
        return ResponseEntity.noContent().build();
    }
}
