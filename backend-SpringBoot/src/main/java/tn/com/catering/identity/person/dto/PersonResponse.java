package tn.com.catering.identity.person.dto;

import java.time.Instant;
import java.util.UUID;
import tn.com.catering.identity.person.ClientType;
import tn.com.catering.identity.person.Person;
import tn.com.catering.identity.person.Role;

public record PersonResponse(
        UUID id,
        String email,
        Role role,
        ClientType clientType,
        String firstName,
        String lastName,
        String companyName,
        String taxIdentifier,
        String phone,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt) {

    public static PersonResponse from(Person person) {
        return new PersonResponse(
                person.getId(), person.getEmail(), person.getRole(), person.getClientType(),
                person.getFirstName(), person.getLastName(), person.getCompanyName(),
                person.getTaxIdentifier(), person.getPhone(), person.isEnabled(),
                person.getCreatedAt(), person.getUpdatedAt());
    }
}
