package tn.com.catering.identity.auth;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.com.catering.identity.person.Person;
import tn.com.catering.identity.person.PersonService;
import tn.com.catering.identity.person.dto.LoginRequest;
import tn.com.catering.identity.person.dto.PersonResponse;
import tn.com.catering.identity.person.dto.RegisterRequest;
import tn.com.catering.identity.security.JwtService;
import tn.com.catering.identity.security.SessionCookieService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final PersonService people;
    private final JwtService jwtService;
    private final SessionCookieService cookies;

    public AuthController(AuthService authService, PersonService people, JwtService jwtService, SessionCookieService cookies) {
        this.authService = authService;
        this.people = people;
        this.jwtService = jwtService;
        this.cookies = cookies;
    }

    @PostMapping("/register")
    ResponseEntity<PersonResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
        Person person = people.register(request);
        response.addHeader(cookies.headerName(), cookies.authenticated(jwtService.issue(person)));
        return ResponseEntity.status(HttpStatus.CREATED).body(PersonResponse.from(person));
    }

    @PostMapping("/login")
    PersonResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        Person person = authService.authenticate(request);
        response.addHeader(cookies.headerName(), cookies.authenticated(jwtService.issue(person)));
        return PersonResponse.from(person);
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletResponse response) {
        response.addHeader(cookies.headerName(), cookies.cleared());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    PersonResponse me(Principal principal) {
        return PersonResponse.from(people.byId(UUID.fromString(principal.getName())));
    }
}
