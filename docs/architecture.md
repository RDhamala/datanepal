# Architecture

Reflects the system as built, after the architecture validation pass of
2026-08-23. Decisions expensive to reverse have their own ADRs in
[`docs/adr/`](adr/).

---

## 1. System overview

```
SOURCES        HDX COD-AB · HDX COD-PS · Wikidata · World Bank API
                                  │
INGESTION      dlt, one connector per source
(Python)       validates shape at the boundary; fails on a changed source
                                  │
               raw_hdx_admin · raw_hdx_population
               raw_wikidata_names · raw_worldbank
                                  │
WAREHOUSE      staging/        rename, type, trim. One model per source table.
(DuckDB)       intermediate/   canonical model: places, identifiers, observations
               marts/          the public contract
                                  │
               129 dbt tests. A failure stops the build; nothing ships.
                                  │
REVISIONS      publish/revisions.py folds the build into an append-only
               history file committed to git
                                  │
PUBLISH        publish/dist/*.parquet + *.json + manifest.json
               export refuses any table without a catalog entry
               each table's licence computed from its sources
                                  │
SITE           Next.js static export, reads Parquet at build time
                                  │
DEPLOY         Cloudflare Pages builds web/ on push → datanepal.org
```

The warehouse is a build artefact, rebuilt from scratch every run. The two
pieces of persistent state are both committed to git: `publish/dist/` (the
published data) and `history/observation_history.parquet` (revision history).
That is what gives the data a version history without operating a database.

---

## 2. Ingestion

One module per source in `ingestion/sources/`, registered in `ingestion/run.py`.

Every connector validates the shape of what it received before yielding:

- `hdx_admin` asserts 7 provinces, 77 districts, 753 local units
- `hdx_population` asserts 54 measures per place
- `worldbank` asserts a minimum observation count across indicators
- `wikidata_names` asserts a minimum row count against truncated SPARQL results

These exist because of a specific failure. The COD-PS top age band is spelled
`80Plus`; the ingest regex expected `80PL`, so 262,948 people over 80 were
dropped. Place counts were correct. The national/province/district hierarchy
still reconciled, because every file was missing the same cohort. **Every
consistency check passed.** It was caught by rendering a chart and counting the
bars.

The lesson, encoded: assert against **externally known expectations**, not
internal agreement. Internal consistency is satisfied by uniformly wrong data.

Connectors also honour `REQUESTS_CA_BUNDLE` / `SSL_CERT_FILE` via a local
`_verify()` helper, because `httpx` ignores those variables and fails opaquely
behind a TLS-inspecting proxy.

---

## 3. Warehouse layers

| Layer | Materialisation | Rule |
|---|---|---|
| `staging/` | view | One model per source table. Rename, type, trim. **No joins.** |
| `intermediate/` | table | Canonical model. Conformance, crosswalks, the fact table. |
| `marts/` | table | Public contract. Everything here is exported. |

Reference data (`indicators`, `units`, `dimensions`, `dimension_members`,
`licences`) lives in seeds. `datasets` and `table_sources` are **generated** from
the catalog by `catalog/sync_seeds.py`, so provenance has one source of truth.
Provenance that drifts is worse than provenance that is absent, because it looks
authoritative.

---

## 4. Canonical observation model

See [ADR-0003](adr/0003-canonical-observation-model.md).

```
observations
  observation_id    deterministic hash of the natural key
  dataset_id        → datasets      (provenance and licence)
  indicator_id      → indicators    (meaning, unit policy, additivity)
  place_id          → places        NULLABLE
  period_start      date
  period_end        date
  period_type       year | fiscal_year | quarter | month | week | day | instant | multi_year
  value_numeric     nullable
  value_text        nullable
  unit_id           → units         (includes currency and price basis)
  status            actual | provisional | estimate | projection | forecast
                    | suppressed | not_collected
  dimension_key     canonical fingerprint of the dimension set

observation_dimensions
  observation_id · dimension_id · member_id     → dimension_members
```

**Dimensions are data, not columns.** The previous schema carried `sex` and
`age_band` as real columns, which worked for population and failed for budgets
(ministry, economic classification), elections (candidate, party), commodity
prices (commodity, variety), and school counts (level, management). A new
dataset adds rows to `dimension_members`; it never adds columns here.

**`dimension_key`** is a sorted fingerprint like `age_band=all|sex=female`, or
`none`. It exists so duplicate detection and page-level filtering need no join —
the checks most likely to be needed and least affordable to make expensive.

**`place_id` is nullable** because not every measurement is geographic.

**`period_start`/`period_end` are dates.** An integer year cannot express
monthly inflation, a Nepali fiscal year (mid-July to mid-July, spanning two
Gregorian years), or a weekly commodity price.

**Currency and price basis live in the unit.** `usd_current` and
`usd_constant_2015` are different units, not one unit with a modifier — so they
cannot be silently compared.

**`status` distinguishes** a suppressed value from a zero from an unobserved
one. A NULL with `status = 'suppressed'` is information; a NULL with
`status = 'actual'` is a bug, and a test fails on it.

**`is_additive` on indicators** is the guard against the most common way to
produce a confidently wrong number: summing a rate, or unweighted-averaging a
per-capita figure across places.

### Validated against eight dataset shapes

| Dataset type | Representable | How |
|---|---|---|
| Local-level census population | yes | ward places, `sex`/`age_band` dimensions |
| National monthly inflation | yes | `period_type = month`, no dimensions, `percent` |
| Remittance inflows | yes | `usd_current` unit; a `npr_current` variant exists |
| Federal budget by category | yes | hierarchical `budget_category` members, `fiscal_year` |
| Election candidate results | yes | constituency places, `candidate`/`party` dimensions, `value_text` for a winning party |
| School counts by type | yes | `level`/`management` dimensions |
| Health facility counts | yes | `facility_type`/`ownership` dimensions |
| Commodity prices over time | yes | market places, `commodity`/`variety` dimensions, `npr_current`, weekly periods |

Two of these need work beyond the schema, and the schema does not block either:
electoral constituencies and market points are place *types* not yet loaded, and
hierarchical dimension members are supported (`parent_member_id`) but unused.

---

## 5. Geography model

See [ADR-0002](adr/0002-canonical-geography-identity.md).

```
places
  place_id                DataNepal surrogate, 'pl_' + hash
  place_type              country | province | district | metropolitan
                          | sub_metropolitan | municipality | rural_municipality
                          | ward | protected_area | electoral_constituency
  admin_level             0-3, null for non-administrative types
  name_en · name_ne       primary names; NULL means no verified name
  slug                    unique within a parent, for URLs
  parent_place_id         EXPLICIT key
  area_sqkm · center_lat · center_lon
  valid_from · valid_to · superseded_by_place_id     present, unpopulated
  dataset_id

place_identifiers
  place_id · id_system · id_value · is_authoritative · valid_from · valid_to
  unique on (id_system, id_value)
```

**P-codes are a source identifier, not identity.** They are excellent — OCHA
maintains them, they are hierarchical, and the type digit classifies
authoritatively. They are also someone else's namespace. `place_id` is a
DataNepal surrogate; P-codes, Wikidata QIDs, ISO codes and future NSO or
Election Commission codes all live in `place_identifiers`.

**Parents are explicit keys, not P-code substrings.** Substring nesting is a
real property of P-codes and works for the administrative hierarchy. It cannot
express an electoral constituency, a protected area spanning districts, or a
unit merged in a boundary revision. A test asserts the hierarchy is acyclic,
because an explicit parent can contain a cycle where a substring cannot.

**Protected areas need their own URL namespace.** Four of them — Shivapuri,
Dhorpatan, Shuklaphanta, Lumbini Sanskritik — share both a name and a parent
district with a local unit. A test asserts this hazard rather than assuming it
away.

**Historical geography is anticipated, not built.** `valid_from`, `valid_to`,
and `superseded_by_place_id` exist and are NULL. Nepal's 2017 federal
restructuring means pre-2017 data will need a crosswalk; carrying the columns
now avoids a migration touching every observation later. A `place_successions`
table for merges and splits is the intended next step, deliberately unbuilt.

**Crosswalks are a product.** `place_identifiers` is published as a first-class
table. Reconciling Nepal's incompatible geographic coding systems is among the
most valuable things here — see [docs/product.md](product.md).

---

## 6. Provenance and licensing

See [ADR-0006](adr/0006-provenance-enforcement.md) and
[ADR-0007](adr/0007-licensing-boundaries.md).

The chain is technically enforced end to end:

```
published observation
  → dataset_id            (FK, tested)
  → catalog/sources/*.yml (publisher, URL, licence, retrieved, methodology)
  → licence_id            (FK to licences, with share_alike as a boolean)
```

Provenance attaches to the **source dataset**, not the published table. One
source can feed several tables, and a table can draw on several sources.
`catalog/tables/*.yml` declares which sources a table uses; the export computes
the effective licence from them.

**Licence precedence is mechanical.** Where a table draws on several sources,
the most restrictive wins:

```
cc0-1.0 < cc-by-4.0 < cc-by-igo-3.0 < gov-open < cc-by-sa-4.0 < odbl-1.0 < unknown
```

`observations` draws on CC BY-IGO and CC BY 4.0 and therefore publishes as
CC BY-IGO, with both publishers named in `attribution`.

**Share-alike is a tested boundary.** `assert_no_licence_contamination` fails
the build if a share-alike source ever feeds a table without that table being
marked share-alike. OpenStreetMap was rejected as a Nepali-name source on
exactly these grounds — it had usable coverage, but ODbL's share-alike would
have propagated to every table it touched. That decision is now enforced rather
than remembered.

**`unknown` is a real value.** A source with no licence statement is recorded as
`unknown`, never guessed, and `unknown` is ranked as maximally restrictive.

---

## 7. Revisions

See [ADR-0004](adr/0004-revision-history.md).

Sources restate figures. The World Bank revises national accounts; UNFPA
reprojects populations; budgets move from provisional to final.

History is an append-only Parquet file committed to git:
`history/observation_history.parquet`. One row per `(observation_id, revision)`.

```
revision        1 on first sighting, incremented when value or status changes
first_seen_at   when DataNepal first published this revision
published_at    the publisher's own vintage date, where supplied
superseded_at   set on the previous revision when a new one arrives
is_current      exactly one true row per observation_id (tested)
```

Only a change in `value_numeric`, `value_text`, or `status` creates a revision.
Republishing an unchanged value does nothing, so re-running the pipeline is
idempotent — otherwise history fills with noise and stops being readable.

A change in unit or period is a *different observation*, not a revision of this
one, and gets its own `observation_id`.

Five tests cover this: first-load, idempotence, detection with preservation of
the superseded value, single-current-revision, and status-only changes.

---

## 8. Publishing

`publish/export.py` writes one Parquet per mart, JSON for tables under 20,000
rows, and a `manifest.json` describing the set: each table's title, grain,
sources, effective licence, share-alike flag, contributing licences, attribution,
caveats, row count, and size — plus every source dataset's full provenance.

Snappy compression, not zstd. Zstd is smaller, but several readers — including
this project's own `hyparquet` — need a plugin. For published data, readable
everywhere beats 20% smaller.

`publish/dist/` is committed. That gives the published data a version history
and lets Cloudflare Pages build the site with Node alone rather than running the
Python pipeline in its build image.

---

## 9. Frontend

Next.js static export. Every page generated at build time; no server, no runtime
data fetching.

Reads **Parquet**, not JSON — JSON was fine at 4,590 observations and breaks at
ward scale. Two normalisations happen once at the read boundary, both guarding
silent failures:

- Parquet `BIGINT` arrives as JavaScript `BigInt` and throws on contact with a
  number.
- Parquet `DATE` arrives as a `Date` at UTC midnight, which in any negative-UTC
  offset renders as the *previous day*. `1965-01-01` becomes
  `Dec 31 1964 18:00 GMT-0600`, so `.getFullYear()` returns 1964. Every year in
  every time series would be off by one, only west of Greenwich, with no error.

URLs are hierarchical (`/np/bagmati/kathmandu/`) because it is required for
correctness: 22 local-unit names are shared across districts, so slugs are
unique only within a parent.

Population is never presented as a census count when it is a projection. The
`status` field drives that, and it is not cosmetic.

Charts: read the `dataviz` skill first and run its palette validator. The
age-sex pyramid uses categorical slots 1 and 2, validated in both modes, with a
legend, direct labels, and a table fallback.

---

## 10. Testing

| Suite | Count | Runs |
|---|---|---|
| dbt | 129 | `dbt build` |
| Python (revisions) | 5 | `pytest` |
| TypeScript (data layer) | 34 | `vitest` |

Architectural invariants enforced:

- every observation resolves to a valid indicator, unit, dataset, and place
- no duplicate observations on the natural key
- every dimension member used is declared (`assert_dimension_members_are_declared`)
- identifiers unique within their system, never globally
- the place hierarchy is acyclic (`assert_place_hierarchy_is_acyclic`)
- values are present or their absence is explained (`assert_observation_values_are_explained`)
- non-additive units are not attached to additive indicators
- no share-alike licence contamination
- province and district population sums reconcile to the national total
- publication fails for an undocumented table
- revisions never silently replace a prior record

---

## 11. Current limitations

- **Palika-level statistics do not exist.** COD-PS stops at district. 753 of 860
  places have geography but no data. This is the largest content gap and needs
  the NSO census portal, the hardest ingest on the list.
- **District Nepali names are absent.** Provinces are hand-verified; local units
  are 64% covered from Wikidata; districts have none. OSM has all 77, but ODbL.
- **No maps.** The COD GeoJSON is in the HDX package, not ingested.
- **No electoral constituencies or market points.** Place types are modelled;
  the data is not loaded.
- **Historical geography is unpopulated.** Columns exist; no crosswalk.
- **No search.** Google is the discovery path; Pagefind is the intended answer.
- **`gov-open` is an inference.** Sources published by a government body without
  an explicit licence are marked reusable-with-attribution but unverified.

---

## 12. Scaling: static architecture

See [ADR-0001](adr/0001-static-first-deployment.md).

### Works now, comfortably

86 pages · 4,781 observations · 3.7 MB published · sub-second builds ·
zero infrastructure · no attack surface · no per-request cost.

### Expected next limits

| Dimension | Current | First real limit | Cause |
|---|---|---|---|
| Pages | 86 | ~10,000 | build time; still minutes |
| Pages | | **20,000 files per deployment** | **hard Cloudflare Pages limit** |
| Observations | 4,781 | ~2–5 million | `hyparquet` loads whole files into memory at build |
| Published size | 3.7 MB | ~100 MB | git repository weight, since `publish/dist` is committed |
| Search | none | ~10,000 pages | Pagefind index size |

Adding wards (6,743) plus palika statistics is the next real step: roughly 7,600
pages and perhaps 2–5 million observations. Pages are fine. Observations are the
pressure point.

### Triggers for dynamic infrastructure

Introduce it when — and only when — one of these is actually true:

1. **Deployment exceeds ~20,000 files.** Hard platform limit. Split deployments
   or move data to R2 with a Worker in front.
2. **Build exceeds ~15 minutes.** Partition Parquet by dataset and place level so
   a page reads only what it needs.
3. **Users need queries we cannot precompute** — arbitrary filtering, custom
   exports, cross-dataset joins on demand. First answer is DuckDB-WASM in the
   browser; only if that is insufficient does a query service become justified.
4. **Committed data exceeds ~100 MB.** Move `publish/dist` to R2 with a
   content-addressed manifest, keeping the manifest in git for provenance.
5. **A paid API needs metering, auth, or rate limiting.** That is a service, and
   static hosting cannot provide it. See [docs/product.md](product.md).

### Likely migration path

```
now      static Parquet + build-time reads
next     + DuckDB-WASM for client-side query (no infrastructure change)
then     + Cloudflare R2 for data, Pages for the site, Worker for range requests
later    + a read API over the same Parquet, versioned, metered
never    a database as the source of truth — the warehouse stays a build artefact
```

**Remain as simple as possible for as long as possible.** The predecessor
project ran ClickHouse and a FastAPI server on a 2 GB droplet; both fell over,
and the server was the thing that leaked personal data. Static hosting has no
equivalent failure mode.

---

## 13. Versions

See [ADR-0005](adr/0005-duckdb-as-warehouse.md) for the engine choice.

| Component | Version | Rationale |
|---|---|---|
| Python | 3.12 | **Pinned.** 3.14 breaks dbt via mashumaro. |
| dlt | 1.30.0 | Current. |
| DuckDB (Python) | 1.5.5 | Current. |
| dbt-core | 1.9.11 | **Pinned `<1.10`.** Deliberate but stale — see below. |
| dbt-duckdb | 1.9.6 | Matched to dbt-core. |
| Node | 22 (CI) / 26 (local) | CI pinned for reproducibility. |
| Next.js | 15.1.6 | One major behind 16. Static export is a stable surface; no driver to upgrade. |
| Tailwind | 4.3.3 | Current. |
| Vitest | 3.2.7 | One major behind 4. Matched to `@vitest/coverage-v8`. |
| TypeScript | 5.7.3 | 5.9 available. No blocking issue. |
| ESLint | 8.57.1 | **Downgraded** for `eslint-config-next` 15 compatibility. **This is real debt** — ESLint 8 is end-of-life. Resolving it means upgrading Next to 16. |
| hyparquet | 1.29.1 | Current. Pure JS, no native binding. |
| `@types/node` | ^22.12.0 | Range, not a pin: Vite requires `>=22.12.0`, and an exact 22.10.7 pin broke `npm ci`. |

**Known version debt, in priority order:**

1. **ESLint 8 is EOL.** Fixed by upgrading Next 15 → 16, which brings
   `eslint-config-next` 16 with ESLint 9 support. One coordinated upgrade.
2. **dbt-core 1.9 is unsupported** and prints a deprecation notice on every run.
   The `<1.10` pin was added when 1.12 appeared to break the build; the actual
   cause was a Python 3.14 incompatibility, since fixed by pinning Python. The
   pin is probably now unnecessary and should be retested.
3. Vitest 4 and TypeScript 5.9 are routine, low-risk, and not urgent.

Nothing was upgraded during this pass. Each of the above needs its own verified
change rather than being bundled into an architecture review.
