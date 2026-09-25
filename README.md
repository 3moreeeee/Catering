# Société Ferid Khemakhem — catering.com.tn

A complete rebuild of the website of **Société Ferid Khemakhem** (trading as *Catering*), a Tunisian importer and distributor operating since 1985 across three product divisions: food & beverage, professional packaging, and hygiene & disposables.

Angular 22 · SSR + hydration · 324 prerendered pages · bilingual FR/EN · 150-reference B2B catalogue.

> **Before launch, read [`docs/07-content-migration.md`](../docs/07-content-migration.md).**
> Several contact and business details are carried over from the legacy site and **must be confirmed by the business owner**. Grep the codebase for `NEEDS_VERIFICATION` to find every one of them.
>
> **Blocking issue inherited from the legacy site:** `www.catering.com.tn` presents a TLS certificate issued for `cluster120.hosting.ovh.net`. Every browser shows a full-page security warning. This must be fixed before any launch, and no amount of front-end work compensates for it.

---

## Repository layout

```
frontend/   Angular 22 SSR application (public site, panier and /admin UI)
backend/    Spring Boot 3 API (identity, catalogue, panier, devis) on Neon Postgres
```

Each folder is self-contained, with its own dependencies, build and `.gitignore`,
so a host is pointed at one folder as its root directory: `frontend/` for the
Node/SSR host, `backend/` for the Java host. Unless stated otherwise, the `npm`
and `node scripts/...` commands below run from `frontend/`.

## Quick start

```bash
cd frontend
npm install
npm run assets          # generate placeholder logos, imagery, robots.txt
npm run fetch:images    # pull the referenced recoverable legacy photographs
npm start               # dev server → http://localhost:4200
```

The app redirects `/` to a negotiated locale, so open `http://localhost:4200/fr` or `/en`.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Dev server with HMR |
| `npm run build` | Production build (SSR + prerender) **and** sitemap generation |
| `npm run build:only` | Production build without the sitemap step |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against the SSR build |
| `npm run lint` | ESLint, including template accessibility rules |
| `npm run format` | Prettier |
| `npm run assets` | Regenerate placeholder assets + `robots.txt` |
| `npm run fetch:images` | Migrate product photography from the legacy gallery |
| `npm run sitemap` | Regenerate `sitemap.xml` from the build output |
| `npm run analyze` | Bundle composition treemap |

## Production build & serve

```bash
npm run build
node dist/fk-catering/server/server.mjs      # http://localhost:4000
```

The build emits **324 prerendered HTML documents** (18 locale-only pages + 6 category pages + 300 product pages) plus an Express SSR server for anything not prerendered — the bare `/`, legacy WordPress redirects, and unknown paths.

---

## Architecture

```
src/app/
├── core/        config · guards · i18n · layout · motion · seo · three
├── shared/      components · directives · pipes · models · utilities
├── features/    home · about · catalog · product-details · brands · industries · contact · legal
└── data/        typed catalogue data + repository implementations
```

Full detail in [`docs/05-technical-architecture.md`](../docs/05-technical-architecture.md).

### The CMS seam

Nothing above the repository layer knows where content comes from:

```
Component → facade (signals) → Repository interface → InMemory | Http | GraphQL
```

Moving the entire site onto Strapi, Directus, Sanity or a REST API is **a four-line provider change** in `app.config.ts`:

```ts
{ provide: PRODUCT_REPOSITORY,  useExisting: HttpProductRepository },
{ provide: CATEGORY_REPOSITORY, useExisting: HttpCategoryRepository },
{ provide: BRAND_REPOSITORY,    useExisting: HttpBrandRepository },
{ provide: INDUSTRY_REPOSITORY, useExisting: HttpIndustryRepository },
```

No component, store or route changes. An ESLint rule (`no-restricted-imports`) enforces this: importing `data/*.data` from a feature or shared component is a build error.

### State

Angular Signals throughout; RxJS only at I/O boundaries. No NgRx — the app has no state that justifies it.

The catalogue's filter state is **bound bidirectionally to the URL query string**, so every filter combination is shareable, bookmarkable, server-renderable and back-button-correct. There is exactly one source of truth.

### Internationalisation

Locale lives in the URL (`/fr/...`, `/en/...`). UI strings are in `public/i18n/{en,fr}.json` (Transloco); catalogue strings carry both locales inline on the entity, which is how every headless CMS models them too.

`LocalizedRouter` is the only sanctioned way to build an internal link — no component hardcodes a locale prefix, so adding a third language is a data change rather than a find-and-replace.

French typography (narrow no-break spaces before `; ! ?`, guillemets, non-breaking units) is applied by `FrenchTypographyPipe` rather than typed by hand, so CMS content gets it too.

---

## 3D & motion

Three.js powers one hero scene. Geometry is **generated procedurally** — no `.glb`, no Draco decoder, no model payload. `three` is imported only inside `@defer (on viewport)` and only when the capability tier permits it.

`WebGLCapabilityService` returns one of four tiers:

| Tier | Trigger | Behaviour |
|---|---|---|
| `off` | no WebGL2 · `prefers-reduced-motion` · SSR · `saveData` · 2G | **`three` is never imported.** Poster image only. |
| `static` | `deviceMemory < 4` or ≤ 2 cores | One frame, then stop |
| `lite` | coarse pointer / < 768 px | DPR ≤ 1.5, opaque materials, no parallax |
| `full` | everything else | DPR ≤ 2, transmissive materials, 60 fps target |

`SceneHostDirective` owns the whole lifecycle so no scene reimplements it: IntersectionObserver **cancels** the RAF loop on exit (rather than skipping frames), tab blur pauses, a rolling frame-time monitor self-demotes on slow devices, and `ngOnDestroy` disposes every geometry, material and texture then forces context loss.

**The contract, asserted in `e2e/progressive-enhancement.spec.ts`:** the site is fully usable, fully indexable and visually complete with WebGL disabled, with JavaScript disabled, and with motion reduced. Reveal animations start from the *visible* state, so there is no flash-of-invisible-content failure mode.

---

## Testing

```bash
npm test              # 43 unit tests
npm run test:e2e      # Playwright, 5 projects
```

Unit tests cover catalogue integrity (unique slugs, both locales present, no price field anywhere, no `"Hello World"` alt text), search and faceting behaviour, pagination coverage, locale negotiation, and the data-honesty invariants — that unpublished fields stay `null`, that only the three verifiable brands are listed, and that exactly the four founder-named sectors are marked source-verified.

E2E projects: `chromium`, `firefox`, `webkit`, `mobile` (Pixel 7) and `reduced-motion`. They assert the six user flows from `docs/02`, keyboard traversal of header → mega menu → catalogue → filter drawer → product → enquiry, one `h1` per route, no horizontal overflow at 320 px, and content parity with WebGL and JavaScript disabled.

---

## Performance

Current production build:

| Metric | Value |
|---|---|
| Initial bundle (gzipped) | **79 kB** |
| Initial bundle (raw) | 614 kB |
| `three` chunk | 730 kB — lazy, fetched only at tier ≥ `static` |
| GSAP + ScrollTrigger | 114 kB — lazy, never fetched under reduced motion |
| Prerendered documents | 324 |

Techniques applied: route- and component-level lazy loading, `@defer (on viewport)` for all below-the-fold homepage sections with height-reserving placeholders (CLS budget 0.1), explicit `width`/`height` on every image, AVIF/WebP with JPEG fallback, self-hosted subset variable fonts, `100svh` instead of `100vh`, and `overflow-x: clip` on `body` as a hard guarantee against the horizontal scroll the legacy site had at 320 px.

See [`docs/08-performance-checklist.md`](../docs/08-performance-checklist.md).

---

## Deployment

The build produces a hybrid output:

```
dist/fk-catering/
├── browser/     static assets + 324 prerendered pages + sitemap.xml + robots.txt
└── server/      Express SSR entry (server.mjs)
```

**Static-only hosting** (Netlify, Vercel, S3+CloudFront, OVH): serve `browser/` and configure the redirect map below. Prerendered routes cover everything a visitor normally reaches.

**Node hosting** (recommended): run `server.mjs` behind a reverse proxy. Adds correct 404 status codes and live redirect handling.

### Required redirects

Preserve the legacy site's link equity — all `301`:

| From | To |
|---|---|
| `/` | `/fr` |
| `/?lang=en` | `/en` |
| `/?lang=fr` | `/fr` |
| `/agro-alimentaire/` | `/fr/products/food` |
| `/produits-emballage/` | `/fr/products/packaging` |
| `/hygiene/` | `/fr/products/hygiene` |
| `/produits/` | `/fr/products` |
| `/contact/` | `/fr/contact` |
| `/?page_id=7` | `/fr/contact` |

The map is defined once in `src/app/core/config/site.config.ts` and handled at runtime by `LocaleRedirectComponent` when running under Node.

### Environment

| Variable | Purpose |
|---|---|
| `PORT` | SSR server port (default 4000) |
| `CONTACT_MAIL_TO` | Where enquiries are delivered — **not yet implemented** |
| `CAPTCHA_SECRET_KEY` | Server-side spam-protection secret — **not yet provisioned** |

`SITE_CONFIG.captchaSiteKey` is deliberately empty. The integration is wired but inert; no key is hardcoded in the client.

### Accounts and Spring Boot API

The identity API lives in `backend/` and exposes registration, login,
self-service profile/security controls, and administrator-only person CRUD.
Public registration always creates a `CLIENT`; a client is either `PHYSIQUE`
(first and last name) or `MORALE` (company name and tax identifier).

For local development, open two PowerShell terminals:

```powershell
cd backend
$env:APP_ADMIN_EMAIL = 'admin@example.tn'
$env:APP_ADMIN_PASSWORD = 'replace-with-a-long-unique-password'
$env:APP_JWT_SECRET = 'replace-with-at-least-32-random-characters'
.\mvnw.cmd spring-boot:run
```

```powershell
cd frontend
npm start
```

The frontend runs on `http://localhost:4200`, and the API runs on
`http://localhost:8081` (`8080` is already used by Oracle XML DB on this
workstation). H2 file storage is used locally. For Neon, copy
`backend/.env.example` and set `NEON_DATABASE_URL_DIRECT` (preferred
for migrations and catalogue imports) and optionally `NEON_DATABASE_URL` for a
pooled connection. The backend also accepts the traditional `DB_URL`,
`DB_USERNAME`, `DB_PASSWORD`, and `DB_DRIVER=org.postgresql.Driver` variables.
Never commit the real `.env`. In HTTPS production also set
`APP_SECURE_COOKIE=true` and allow only the deployed frontend origin with
`APP_CORS_ORIGINS`.

Product descriptions, prices, stock, offers, formats and media URLs live in
PostgreSQL. Large image and video binaries must live in object storage and be
referenced by URL; storing multi-megabyte videos as PostgreSQL rows would make
catalogue queries, backups and deployments unnecessarily heavy.

Heavy media is hosted by ImageKit while Neon keeps the returned public URLs.
Set `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT`,
then run `npm run media:imagekit`. The import is resumable, preserves stable
file names, rewrites product/category/brand media URLs in Neon transactionally,
and switches cinematic videos and posters to the ImageKit CDN only after every
upload succeeds. The private key is never included in the Angular application.

The session token is held in an HttpOnly, SameSite=Strict cookie; it is never
stored in browser local storage. No default administrator password is shipped.

### Catalogue, panier and devis

The same Spring Boot module owns the catalogue. An administrator manages products
(`POST`/`PUT`/`PATCH`/`DELETE /api/products`, each behind `hasRole('ADMIN')`);
catalogue reads (`GET /api/products`, `/api/products/{slug}`, `/api/categories`,
`/api/brands`, `/api/products/prices`) are public, because the catalogue is the
marketing surface and is server-rendered for anonymous visitors.

A signed-in client builds a panier (`/api/cart`) and converts it with
`POST /api/cart/submit`, which creates a **devis** — a quote request carrying a
reference such as `DEV-2026-0001`. The quote copies each product's name and unit
price at submit time, so a later price change by an administrator never rewrites
what the buyer was shown. No route addresses a cart by id: the cart is always
resolved from the authenticated principal, which is what makes cross-account
access impossible rather than merely denied.

Deleting a product is a soft delete. It disappears from the catalogue but stays
readable by id for the administrator, which is what keeps historical quotes
intelligible.

On the frontend, the bundled catalogue snapshot still serves search, faceting and
prerendering; `PricingService` fetches live prices for the rendered page by
`sourceId`, and `CartService` holds the panier. Prices therefore never enter the
JavaScript bundle, and an edit in the back office needs no rebuild.

#### Seeding the catalogue

On first start, with an empty product table, `CatalogSeeder` loads
`backend/src/main/resources/seed/catalog-seed.json` (247 products, 31
categories, 7 brands). Regenerate that file after any catalogue change:

```powershell
node scripts/export-backend-seed.mjs
```

The script joins the curated bilingual catalogue in `frontend/src/app/data/` with the Vinto
crawl snapshot in `frontend/tmp/vinto-import/raw-products.json`, matching on the numeric
Vinto listing id embedded in each product id, and takes only price, stock quantity
and supplier reference from the crawl. It makes no network request — the crawl is
already on disk. A product with no matching crawl record is exported with
`price: null` and renders as "prix sur demande".

Set `APP_CATALOG_SEED=false` to disable seeding. To reseed from scratch, stop the
application and delete `backend/data/`.

---

## Known gaps

Deliberate, and each one is a decision rather than an oversight:

- **The contact endpoint is not implemented.** `POST /api/contact` needs a mail transport and spam verification on the server. The client is complete: it posts, handles loading/success/failure, and **preserves the user's entries on failure**.
- **Placeholder imagery throughout.** `npm run assets` generates palette-correct SVG stand-ins. Real photography is a client deliverable.
- **Partner brand logos are typographic stand-ins.** Reproducing Monin's, Martellato's or Plastport's actual trademark requires the brand owner's permission; a fabricated logo is not an option.
- **No global search overlay yet.** Catalogue search, URL-bound filtering and the homepage discovery form are complete; the `/`-shortcut cross-entity overlay is not.
- **The About timeline has two entries.** Only the 1985 founding date is documented. An honest short timeline beats an invented long one.

## Deliberate non-features

- **No invented prices.** Prices are published (see *Catalogue, panier and devis* below) but they come from the Vinto catalogue snapshot the owner supplied. A reference with no supplied price shows "prix sur demande" and is never rendered as 0. Prices are never baked into the bundled catalogue or into `Product` structured data — they are fetched from the API at runtime so a back-office edit is not frozen at build time.
- **No statistics or animated counters.** No client count, employee count, or volume figure has been published. `1985` is the only number on the site, and it is the only one that is documented.
- **No certification logos.** The founder's message refers to suppliers holding "the highest internationally recognised certifications" but names none.
- **No checkout and no payment.** There *is* a panier (added 2026-09-10 on the owner's instruction, aligning catering.com.tn with the sibling site vinto.tn), but its only exit is a *demande de devis*: submitting freezes the lines into a quote for the commercial team, who answer off-platform. No order entity, no payment gateway, no delivery-cost line.
- **`LocalBusiness` structured data is withheld** until coordinates are supplied. A pin in the wrong place is worse than no pin.

## Documentation

| Document | Contents |
|---|---|
| [`docs/01-audit.md`](../docs/01-audit.md) | Audit of the legacy site — 17 findings, verified business content, content gaps |
| [`docs/02-sitemap-and-flows.md`](../docs/02-sitemap-and-flows.md) | UX strategy, sitemap, redirect map, six user flows |
| [`docs/03-creative-direction.md`](../docs/03-creative-direction.md) | Creative concept, colour system with verified contrast ratios, type scale, motion language |
| [`docs/04-homepage-wireframe.md`](../docs/04-homepage-wireframe.md) | Section-by-section wireframe, desktop and mobile |
| [`docs/05-technical-architecture.md`](../docs/05-technical-architecture.md) | Angular architecture, CMS seam, engineering rules, test strategy |
| [`docs/06-3d-concept.md`](../docs/06-3d-concept.md) | 3D concept, capability tiers, lifecycle guarantees, fallback contract |
| [`docs/07-content-migration.md`](../docs/07-content-migration.md) | **Pre-launch checklist for the business owner** |
| [`docs/08-performance-checklist.md`](../docs/08-performance-checklist.md) | Performance and Core Web Vitals checklist |

## Licence

Proprietary — Société Ferid Khemakhem.
