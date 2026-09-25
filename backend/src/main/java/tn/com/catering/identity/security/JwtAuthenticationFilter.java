package tn.com.catering.identity.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tn.com.catering.identity.person.Person;
import tn.com.catering.identity.person.PersonRepository;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final PersonRepository repository;

    public JwtAuthenticationFilter(JwtService jwtService, PersonRepository repository) {
        this.jwtService = jwtService;
        this.repository = repository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            token(request).flatMap(this::authenticate).ifPresent(authentication ->
                    SecurityContextHolder.getContext().setAuthentication(authentication));
        }
        chain.doFilter(request, response);
    }

    private Optional<UsernamePasswordAuthenticationToken> authenticate(String token) {
        try {
            UUID id = jwtService.subject(token);
            return repository.findById(id)
                    .filter(Person::isEnabled)
                    .map(person -> new UsernamePasswordAuthenticationToken(
                            person.getId().toString(), null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + person.getRole().name()))));
        } catch (JwtException | IllegalArgumentException ignored) {
            return Optional.empty();
        }
    }

    private Optional<String> token(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return Optional.of(authorization.substring(7).trim());
        }
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return Optional.empty();
        return Arrays.stream(cookies)
                .filter(cookie -> SessionCookieService.COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> !value.isBlank())
                .findFirst();
    }
}
