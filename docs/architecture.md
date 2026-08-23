# Architecture and design

Status: draft, 2026-08-23. Decisions here are settled unless marked **OPEN**.

---

## 1. What this is

A platform that ingests Nepal's public datasets, conforms them to a shared
geographic spine, and publishes them as open, documented, downloadable data.

The product surface is **a page for every place in Nepal**. The durable asset
underneath is the conformed data itself.

Non-goals, stated so they don't creep in: this is not a voter lookup, not a
dashboard product, not a general BI tool, and not a place that hosts personal
data.

---

## 2. Information architecture

### URL structure

Hierarchical, mirroring the P-code hierarchy:

```
/                                                     homepage
/np/bagmati                                           province
/np/bagmati/kathmandu                                 district
/np/bagmati/kathmandu/kathmandu-metropolitan-city     local unit
/data/geography                                       dataset page
/data/census-2021                                     dataset page
/compare?places=NP0327101,NP0430101                   comparison
/about, /methodology, /api                            meta
```

**Why hierarchical rather than flat `/palika/kathmandu`:** 22 local-unit names
are shared across districts — four places named Madi, four named Tribeni, 52
units affected in total. `(district, name)` is unique with zero collisions, so
including the district in the path is required for correctness, not style. It
also makes breadcrumbs free and communicates the hierarchy without explanation.

**P-code URLs** (`/p/NP0327101`) resolve as permanent aliases that redirect to
the canonical slug path. Slugs can change if a place is renamed; P-codes don't.
Anything machine-facing should cite the P-code form.

**Slugs** are generated from the English name, lowercased and hyphenated, and
frozen at first publication. A slug change is a redirect, never a silent move.

### Page types

Five, and no more without a reason:

| Type | Count | Purpose |
|---|---|---|
| Homepage | 1 | Orient, search, headline national figures |
| Place | 837 | Everything known about one place |
| Dataset | ~10 | Provenance, methodology, bulk download |
| Compare | 1 | Side-by-side across 2–4 places |
| Meta | ~4 | About, methodology, API, changelog |

### Place page structure

One page, sectioned. Not sub-pages.

```
Breadcrumb:  Nepal › Bagmati › Kathmandu › Kathmandu Metropolitan City

Header       Name (EN + NE), type, P-code, parent links
At a glance  6–8 headline figures, each linking to its source
Map          The unit outlined within its district
Population   Census figures, age/sex structure
Society      Literacy, education, households
Geography    Area, density, elevation, centroid
Governance   Type, ward count, representatives (later)
Elections    (later)
Economy      (later)
Sources      Every dataset feeding this page, with vintage
Download     CSV / JSON / Parquet for this place
```

Sections render only when data exists. An empty section is omitted, never shown
as "no data" — a page that is mostly absence reads as a broken page.

**Split a section into its own page only when it has enough depth to stand
alone** — e.g. `/elections` after three cycles of results. Premature splitting
fragments the ranking signal and adds a click for no gain.

### Homepage

Restrained. Its job is to orient and route, not to impress.

```
Nepal, in data.

[ Search any place, dataset, or statistic ]

7 provinces · 77 districts · 753 local units · N datasets

[ Map of Nepal — click through to any province ]

Featured datasets · Recently updated · About the project
```

Headline national figures appear only once a dataset backs them. Placeholder
numbers on a data platform are self-discrediting.

---

## 3. Data architecture

```
sources → ingestion (dlt) → warehouse (DuckDB) → transform (dbt) → publish (static)
```

### Join keys

Everything keys on **OCHA P-codes**. Positional and hierarchical:

```
NP 03 27 1 01
│  │  │  │  └─ sequence within district
│  │  │  └──── type: 1 metro · 2 sub-metro · 3 municipality
│  │  │              4 rural municipality · 5 protected area
│  │  └─────── district
│  └────────── province
└───────────── country
```

A child's code is prefixed by its parent's, so hierarchy joins are substring
operations. The type digit classifies authoritatively — never match on Nepali
name suffixes, which nest as substrings (`उपमहानगरपालिका` contains
`महानगरपालिका`) and misclassify silently.

Nepal has no universal local-unit identifier. Other sources reach the spine
through **crosswalk tables**, never by name matching: English/Nepali
transliteration is not standardised. Crosswalk method, in order:

1. Exact match on `(district, normalised name)`
2. Geometry — point-in-polygon against COD boundaries
3. Hand-verify the residue

Every crosswalk is tested for being 1:1 and total. Crosswalks are published as
first-class datasets; nobody else has built them.

### Modelling layers

| Layer | Materialisation | Rule |
|---|---|---|
| `staging/` | view | One model per source table. Rename, type, trim. No joins. |
| `intermediate/` | table | Conformed dimensions and crosswalks. The spine lives here. |
| `marts/` | table | Public contract. Everything here is exported. |

**OPEN — indicator/observation model.** Proposed but not built: a canonical
long-format fact table (`indicator × place × period × value × source ×
revision`) alongside domain marts. Makes compare, search, and charts generic
rather than bespoke per dataset. Should land before dataset #3.

### Revisions

Statistics get revised; NRB revises routinely. Never overwrite silently. Keep
prior values, expose "revised on <date>". dbt snapshots.

### Publication

Static Parquet + JSON + `manifest.json` on a CDN. No API server.

The entire administrative geography of Nepal is **34 KB of Parquet**. That
number is the argument: this does not need a database server, and a server is
precisely what fell over in the predecessor.

DuckDB-WASM is deferred. It is a ~3 MB payload and earns its place only when a
page genuinely needs to query millions of rows client-side. Plain JSON fetch
until then.

---

## 4. Frontend

**Next.js**, static export. Every place page generated at build time from the
published Parquet — no runtime data fetching, no database, no server.

- **Maps:** MapLibre GL, boundaries from the COD GeoJSON
- **Charts:** Observable Plot
- **Search:** Pagefind, built at deploy. Google is the primary discovery path;
  on-site search is for people already there.
- **Hosting:** Cloudflare Pages, with Parquet on R2

### Bilingual

EN and नेपाली are equals, not a translation layer bolted on. Both names live on
the entity. URLs stay canonical (English slugs); content switches.

Dates render in both Bikram Sambat and Gregorian. Nepali government sources
publish in BS, and getting this wrong silently misdates everything.

**OPEN — Nepali names.** The COD is English-only. Currently held for 7
provinces (hand-seeded), missing for 77 districts and 753 local units. This
blocks bilingual and has no identified source yet. Highest-priority gap.

---

## 5. Constraints

**Aggregates only.** No personal data is ingested, stored, or published. Nepal's
Privacy Act 2075 (2018) names voter identity card details as protected personal
information. Connectors fetch counts, not records; if a source only offers
row-level data, aggregate at ingestion and discard the rows.

**Respect robots.txt.** `voterlist.election.gov.np` sets `Disallow: /` and marks
itself `noindex, nofollow`. It is not a source. Prefer sources published for
reuse over sources that merely happen to be reachable.

**Provenance is mandatory.** Every published table needs a catalog entry with
source, licence, vintage, and caveats. `publish/export.py` refuses to publish
without one. Where a source states no licence, record `unknown` — never guess.

**Completeness is tested, not assumed.** A load that drops half of Karnali
raises no error and produces no obviously wrong row count; it just quietly
under-reports. Assert counts against known-good expectations.

---

## 6. Plan

### Phase 1 — Foundation ✅

Geography spine live: 753 local units, 77 districts, 7 provinces, P-coded, with
area and centroids. 22 protected areas published separately. 37 dbt tests, CI
green, static export working.

### Phase 2 — Prove the model

The test of whether the architecture generalises is dataset #2, not #12.

1. Source Nepali names for districts and local units — **blocking**
2. Census 2021 connector (NSO, ward level)
3. NSO ↔ P-code crosswalk, tested 1:1 and total
4. Ingest COD GeoJSON boundaries
5. Refactor to the indicator/observation model

### Phase 3 — V1 product

837 static place pages, bilingual, with census and geography. Compare across
2–4 places. Per-place and per-dataset download. Every figure traceable.

Out of scope for V1, deliberately: elections, economy, on-site search beyond
Pagefind, an API beyond the static files, accounts, admin console.

### Phase 4 — Breadth

Elections, economy (NRB), education, health. Each is now an exercise in writing
one connector and one crosswalk, which is the point of everything above.

### Success test for V1

Someone searches "Tarakeshwor population", lands on our page, gets a correct
figure with a visible source, and can download the data. If that works 753
times, the platform works.
