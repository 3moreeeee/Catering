package tn.com.catering.identity.person.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import tn.com.catering.identity.person.ClientType;

public record UpdateProfileRequest(
        @NotNull ClientType clientType,
        @Size(max = 100) String firstName,
        @Size(max = 100) String lastName,
        @Size(max = 180) String companyName,
        @Size(max = 80) String taxIdentifier,
        @NotBlank @Email @Size(max = 254) String email,
        @Pattern(regexp = "^$|^[+0-9][0-9 .()/-]{5,28}$") String phone) {}
