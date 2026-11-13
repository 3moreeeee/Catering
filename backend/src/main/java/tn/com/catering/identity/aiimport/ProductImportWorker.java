package tn.com.catering.identity.aiimport;

import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tn.com.catering.identity.aiimport.ProductImportItem.Status;
import tn.com.catering.identity.aiimport.ProductVisionClient.AiCallException;

/**
 * Processes queued photographs in the background, a few at a time.
 *
 * <p>At most {@code app.ai.concurrency} items are in flight, and calls to the
 * model are spaced to stay under {@code app.ai.requests-per-minute}, so a batch
 * of 246 images never trips the provider's rate limit. The queue is the
 * database itself: an upload saves a QUEUED row and wakes the worker, and a
 * restart puts anything left PROCESSING back in the queue.
 */
@Component
public class ProductImportWorker {

    static final int MAX_ATTEMPTS = 3;

    private static final Logger log = LoggerFactory.getLogger(ProductImportWorker.class);

    private final ProductImportItemRepository items;
    private final ProductVisionClient vision;
    private final ProductDraftParser parser;
    private final ProductMatcher matcher;
    private final ImportTaxonomyLoader catalogue;
    private final PriceListRowRepository priceRows;
    private final PricePicker pricePicker;
    private final AiImportSettings settings;
    private final TransactionTemplate tx;
    private final ExecutorService pool;
    private final AtomicInteger running = new AtomicInteger();
    private final Object claimLock = new Object();
    private final Object rateLock = new Object();
    private long nextCallAt = 0;

    public ProductImportWorker(ProductImportItemRepository items, ProductVisionClient vision,
                               ProductDraftParser parser, ProductMatcher matcher,
                               ImportTaxonomyLoader catalogue, PriceListRowRepository priceRows,
                               PricePicker pricePicker, AiImportSettings settings,
                               PlatformTransactionManager transactions) {
        this.items = items;
        this.vision = vision;
        this.parser = parser;
        this.matcher = matcher;
        this.catalogue = catalogue;
        this.priceRows = priceRows;
        this.pricePicker = pricePicker;
        this.settings = settings;
        this.tx = new TransactionTemplate(transactions);
        this.pool = Executors.newFixedThreadPool(settings.concurrency(), runnable -> {
            Thread thread = new Thread(runnable, "ai-import");
            thread.setDaemon(true);
            return thread;
        });
    }

    @EventListener(ApplicationReadyEvent.class)
    public void resumeAfterRestart() {
        Integer requeued = tx.execute(status -> items.requeue(Status.PROCESSING, Status.QUEUED));
        if (requeued != null && requeued > 0) log.info("AI import: {} item(s) put back in the queue", requeued);
        wake();
    }

    /** Starts drainers up to the concurrency limit; a no-op while the AI is not configured. */
    public void wake() {
        if (!settings.configured()) return;
        while (true) {
            int current = running.get();
            if (current >= settings.concurrency()) return;
            if (running.compareAndSet(current, current + 1)) {
                pool.submit(this::drain);
            }
        }
    }

    private void drain() {
        try {
            Optional<UUID> next;
            while ((next = claim()).isPresent()) {
                process(next.get());
            }
        } catch (RuntimeException unexpected) {
            log.error("AI import worker stopped on an unexpected error", unexpected);
        } finally {
            running.decrementAndGet();
        }
        // An upload that landed between the last empty claim and the decrement
        // would otherwise wait for the next wake-up.
        if (tx.execute(status -> items.countByStatus(Status.QUEUED)) > 0) wake();
    }

    private Optional<UUID> claim() {
        synchronized (claimLock) {
            return tx.execute(status -> items.findFirstByStatusOrderByCreatedAtAsc(Status.QUEUED)
                    .map(item -> {
                        item.setStatus(Status.PROCESSING);
                        item.setAttempts(item.getAttempts() + 1);
                        return item.getId();
                    }));
        }
    }

    void process(UUID id) {
        ProductImportItem snapshot = tx.execute(status -> items.findById(id).orElse(null));
        if (snapshot == null) return;
        try {
            ImportTaxonomy taxonomy = catalogue.taxonomy();
            awaitRateLimit();
            String raw = vision.describe(parser.systemPrompt(taxonomy),
                    parser.userText(snapshot.getOriginalFilename()), snapshot.getImageUrl());
            ProductDraft draft = parser.parse(raw, taxonomy);
            List<ProductMatcher.Candidate> candidates = catalogue.candidates();
            String fileTitle = stripExtension(snapshot.getOriginalFilename());
            // The client's file names are not always right: a photo of sweet corn
            // arrived named "Champignons en tranches". When the model reports
            // that the file name describes another product, the label wins for
            // matching, so the wrong product's image is never proposed for
            // replacement, and the reviewer is told to check. The model decides,
            // not a word comparison: "124805-MUDDLER-HD" and "Pilon à cocktail"
            // share no word yet are the same product.
            boolean contradicts = Boolean.FALSE.equals(draft.fileNameMatches());
            Optional<ProductMatcher.Match> match = contradicts
                    ? matcher.best(candidates, draft.nameFr())
                    : matcher.best(candidates, fileTitle, draft.nameFr());
            String warning = contradicts
                    ? "Le nom du fichier (« " + fileTitle + " ») ne correspond pas à ce que l'IA lit sur l'image (« "
                            + draft.nameFr() + " »). Vérifiez de quel produit il s'agit."
                    : null;
            PriceFinding price = findPrice(draft, contradicts ? null : fileTitle);
            tx.executeWithoutResult(status -> items.findById(id).ifPresent(item -> {
                item.applyDraft(draft);
                item.applyPrice(price.source(), price.saleMode(), price.price(), price.note());
                if (price.lot() != null) item.setPackQuantity(price.lot());
                if (price.unitLabel() != null) item.setUnitLabel(price.unitLabel());
                item.setModel(settings.model());
                item.setError(null);
                item.setWarning(warning);
                item.setMatchedProductId(null);
                item.setMatchedProductName(null);
                item.setMatchScore(null);
                match.ifPresentOrElse(found -> {
                    item.setAction(ProductImportItem.Action.REPLACE_IMAGE);
                    item.setMatchedProductId(found.id());
                    item.setMatchedProductName(found.name());
                    item.setMatchScore(found.score());
                }, () -> item.setAction(ProductImportItem.Action.CREATE));
                item.setStatus(Status.READY);
            }));
        } catch (AiCallException error) {
            fail(id, error.getMessage(), error.retryable());
        } catch (ProductDraftParser.DraftRejectedException error) {
            fail(id, error.getMessage(), true);
        } catch (RuntimeException error) {
            log.warn("AI import of {} failed", id, error);
            fail(id, "Erreur inattendue : " + error.getClass().getSimpleName(), false);
        }
    }

    private record PriceFinding(String source, String saleMode, java.math.BigDecimal price, Integer lot,
                                String unitLabel, String note) {
        static PriceFinding none(String note) {
            return new PriceFinding(null, null, null, null, null, note);
        }
    }

    /**
     * The price step: five closest price-list rows, the model's choice among
     * them, then the lot price. Any failure here leaves the item reviewable
     * without a price rather than failing the photograph.
     */
    private PriceFinding findPrice(ProductDraft draft, String fileTitle) {
        try {
            List<PriceListRow> rows = priceRows.findAllByOrderByListNameAscPositionAsc();
            if (rows.isEmpty()) return PriceFinding.none("Aucune liste de prix chargée.");
            List<PriceListRow> candidates = pricePicker.candidates(rows, draft.nameFr(), draft.nameEn(), fileTitle);
            if (candidates.isEmpty()) return PriceFinding.none("Aucune ligne proche dans les listes de prix.");
            awaitRateLimit();
            String answer = vision.ask(pricePicker.systemPrompt(),
                    pricePicker.userText(draft, fileTitle == null ? "(nom de fichier incorrect)" : fileTitle, candidates));
            return pricePicker.parseChoice(answer, candidates.size())
                    .map(choice -> {
                        PricePicker.Suggestion suggestion = pricePicker.price(candidates.get(choice.index()), choice,
                                draft.packQuantity(), draft.nameFr(), fileTitle);
                        return new PriceFinding(suggestion.row().describe(), suggestion.saleMode().name(),
                                suggestion.price(), suggestion.lotQuantity(), suggestion.unitLabel(), suggestion.note());
                    })
                    .orElseGet(() -> PriceFinding.none(
                            "L'IA n'a reconnu ce produit dans aucune ligne des listes de prix : saisissez le prix."));
        } catch (RuntimeException error) {
            log.warn("Price lookup failed", error);
            return PriceFinding.none("Recherche du prix impossible : " + error.getMessage());
        }
    }

    private void fail(UUID id, String message, boolean retryable) {
        tx.executeWithoutResult(status -> items.findById(id).ifPresent(item -> {
            item.setError(message);
            boolean again = retryable && item.getAttempts() < MAX_ATTEMPTS;
            item.setStatus(again ? Status.QUEUED : Status.FAILED);
        }));
    }

    /** Spaces model calls evenly across the minute rather than bursting and then waiting. */
    private void awaitRateLimit() {
        long wait;
        synchronized (rateLock) {
            long interval = 60_000L / settings.requestsPerMinute();
            long now = System.currentTimeMillis();
            long slot = Math.max(now, nextCallAt);
            nextCallAt = slot + interval;
            wait = slot - now;
        }
        if (wait > 0) {
            try {
                Thread.sleep(wait);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("interrupted", interrupted);
            }
        }
    }

    static String stripExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }
}
