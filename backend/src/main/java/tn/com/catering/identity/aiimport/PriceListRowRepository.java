package tn.com.catering.identity.aiimport;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PriceListRowRepository extends JpaRepository<PriceListRow, UUID> {

    List<PriceListRow> findAllByOrderByListNameAscPositionAsc();

    @Modifying
    @Query("delete from PriceListRow r where r.listName = :listName")
    int deleteByListName(@Param("listName") String listName);

    /** One line per list: its name, file, row count and upload time. */
    @Query("""
            select r.listName, max(r.sourceFile), count(r), max(r.uploadedAt)
            from PriceListRow r group by r.listName order by r.listName
            """)
    List<Object[]> summary();
}
