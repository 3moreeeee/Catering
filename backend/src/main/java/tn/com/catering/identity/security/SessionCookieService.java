package tn.com.catering.identity.security;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class SessionCookieService {
    public static final String COOKIE_NAME = "FK_SESSION";
    private final JwtService jwtService;
    private final boolean secure;

    public SessionCookieService(JwtService jwtService, @Value("${app.jwt.secure-cookie:false}") boolean secure) {
        this.jwtService = jwtService;
        this.secure = secure;
    }

    public String authenticated(String token) {
        return base(token, jwtService.lifetime()).build().toString();
    }

    public String cleared() {
        return base("", Duration.ZERO).build().toString();
    }

    public String headerName() {
        return HttpHeaders.SET_COOKIE;
    }

    private ResponseCookie.ResponseCookieBuilder base(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/api")
                .maxAge(maxAge);
    }
}
