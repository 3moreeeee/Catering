package tn.com.catering.identity.repositories;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tn.com.catering.identity.entities.Quote;
import tn.com.catering.identity.entities.QuoteStatus;

public interface QuoteRepository extends JpaRepository<Quote, UUID> {
    List<Quote> findByPersonIdOrderByCreatedAtDesc(UUID personId);
    Page<Quote> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Quote> findByStatusOrderByCreatedAtDesc(QuoteStatus status, Pageable pageable);
    long countByReferenceStartingWith(String prefix);

    long countByStatus(QuoteStatus status);

    List<Quote> findTop5ByOrderByCreatedAtDesc();

    /**
     * Submission timestamps since a cut-off, for the activity series.
     *
     * <p>Returns the instants and groups them by day in Java rather than in SQL:
     * date truncation is dialect-specific, and the integration tests run on H2
     * while production runs on Postgres. At devis volumes the difference does
     * not matter.
     */
    @Query("select q.createdAt from Quote q where q.createdAt >= :since")
    List<Instant> findCreatedAtSince(@Param("since") Instant since);
}
