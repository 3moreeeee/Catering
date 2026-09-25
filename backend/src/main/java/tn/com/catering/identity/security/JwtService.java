package tn.com.catering.identity.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tn.com.catering.identity.person.Person;

@Service
public class JwtService {
    private static final Logger LOGGER = LoggerFactory.getLogger(JwtService.class);
    private final SecretKey key;
    private final Duration lifetime;

    public JwtService(
            @Value("${app.jwt.secret:}") String configuredSecret,
            @Value("${app.jwt.lifetime:PT8H}") Duration lifetime) {
        this.lifetime = lifetime;
        String secret = configuredSecret;
        if (secret == null || secret.isBlank()) {
            byte[] generated = new byte[64];
            new SecureRandom().nextBytes(generated);
            secret = Base64.getEncoder().encodeToString(generated);
            LOGGER.warn("APP_JWT_SECRET is not configured. Generated an ephemeral development key; sessions will reset on restart.");
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("APP_JWT_SECRET must contain at least 32 characters.");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public String issue(Person person) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(person.getId().toString())
                .claim("role", person.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(lifetime)))
                .signWith(key)
                .compact();
    }

    public UUID subject(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        return UUID.fromString(claims.getSubject());
    }

    public Duration lifetime() {
        return lifetime;
    }
}
