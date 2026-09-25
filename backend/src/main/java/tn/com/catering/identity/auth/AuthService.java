package tn.com.catering.identity.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.common.ApiException;
import tn.com.catering.identity.person.Person;
import tn.com.catering.identity.person.PersonService;
import tn.com.catering.identity.person.dto.LoginRequest;

@Service
public class AuthService {
    private final PersonService people;
    private final PasswordEncoder passwordEncoder;

    public AuthService(PersonService people, PasswordEncoder passwordEncoder) {
        this.people = people;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public Person authenticate(LoginRequest request) {
        Person person = people.byEmail(request.email());
        if (!person.isEnabled() || !passwordEncoder.matches(request.password(), person.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Invalid email or password.");
        }
        return person;
    }
}
