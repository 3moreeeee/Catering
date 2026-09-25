package tn.com.catering.identity.common;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException error) {
        return ResponseEntity.status(error.getStatus())
                .body(new ApiError(error.getCode(), error.getMessage(), Map.of(), Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException error) {
        Map<String, String> fields = new LinkedHashMap<>();
        error.getBindingResult().getFieldErrors().forEach(field ->
                fields.putIfAbsent(field.getField(), field.getDefaultMessage()));
        return ResponseEntity.unprocessableEntity()
                .body(new ApiError("validation_failed", "Some fields are invalid.", fields, Instant.now()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> malformed(HttpMessageNotReadableException error) {
        return ResponseEntity.badRequest()
                .body(new ApiError("invalid_request", "The request body is invalid.", Map.of(), Instant.now()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> denied(AccessDeniedException error) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError("forbidden", "You are not allowed to perform this action.", Map.of(), Instant.now()));
    }
}
