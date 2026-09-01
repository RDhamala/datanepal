# CLAUDE.md

Instructions for working on this project. These are constraints, not
preferences — several were learned the expensive way.

## What this is

A platform that ingests Nepal's public datasets, conforms them to a shared
geographic spine, and publishes them as open, documented, downloadable data.
Live at [datanepal.org](https://datanepal.org).

```
sources → ingestion (dlt) → warehouse (DuckDB) → transform (dbt) → publish (static) → web (Next.js)
```

## Project Skills

Ten Skills under `.claude/skills/` encode what's specific and repeatable about
this project — not things Claude already knows (React, dbt, SQL). Use the
relevant one(s) rather than re-deriving these rules from scratch:

| Skill | Owns |
|---|---|
| `datanepal-ui` | Interface chrome: layout, typography, cards, bilingual presentation, provenance display |
| `datanepal-dataviz` | Chart-type choice, chart mechanics, colour roles, maps-as-visualization |
| `datanepal-visual-review` | Browser-based visual QA — required after any UI/chart/map change, before calling it done |
| `datanepal-accessibility` | Keyboard operability, screen-reader semantics, bilingual `lang`, and the data table behind every chart |
| `datanepal-place-page` | Information architecture of Nepal/province/district/local-government pages |
| `datanepal-topic-page` | Information architecture of topic hub pages |
| `datanepal-source-research` | Evaluating a candidate Nepal dataset before ingestion |
| `datanepal-ingestion` | Building the source-to-canonical pipeline for a new dataset |
| `datanepal-geography` | Canonical place identity, crosswalks, P-code/geography rules |
| `datanepal-data-quality` | What to test, and the publication gate |

Frontend work always pairs a build skill with `datanepal-visual-review` — code
that passes CI is not the same as a page that looks right — and with
`datanepal-accessibility` whenever the change adds a chart, map, table or
control, since a page that looks right can still be unreachable by keyboard.
Ingestion work always
pairs `datanepal-ingestion` with `datanepal-data-quality`, and with
`datanepal-geography` whenever a new source's identifiers need to join the
spine. See each Skill's frontmatter for exactly when it should trigger.

## Hard constraints

**Never ingest, store, or publish personal data.** This platform publishes
aggregates. Nepal's Privacy Act 2075 (2018) names voter identity card details
as protected personal information. The predecessor project served an
unauthenticated endpoint returning names, voter ID numbers, and parents' and
spouses' names for any municipality in Nepal. If a source only offers row-level
data, aggregate at ingestion and discard the rows — aggregation belongs before
storage, not after. Every catalog entry must assert
`contains_personal_data: false`, and the schema requires it to be false.

**Check `robots.txt` before writing any connector.**
`voterlist.election.gov.np` is `Disallow: /` for all agents. Prefer sources
published for reuse over sources that merely happen to be reachable. Identify
the crawler honestly in the User-Agent; do not impersonate a browser.

**Never transliterate a name.** Nepali romanisation is not standardised. A
guessed name in a reference dataset that other people build on is worse than a
visible gap. Leave it NULL and let the coverage test report it.

**Provenance is mandatory.** `publish/export.py` refuses to publish a table
without a catalog entry stating source, licence, vintage, and caveats. Where a
source states no licence, record `unknown` — never guess.

**Watch licence compatibility.** The spine is CC BY-IGO and names are CC0.
OpenStreetMap is ODbL, whose share-alike terms propagate to derived databases;
it was rejected as a name source for that reason despite having usable coverage.
Check before adding a source.

## Join keys

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
operations. **Use the type digit, never Nepali name suffixes** — those nest as
substrings (`उपमहानगरपालिका` contains `महानगरपालिका`) and misclassify silently.

Type 5 is protected areas: federally administered, not local units, and
excluded from the spine. That exclusion is what makes the count 753 rather
than 775.

Sources that are not P-coded reach the spine through **crosswalk tables**,
never by fuzzy name matching. Crosswalks must be tested 1:1 and total.

One source is matched on names, and the reasoning is worth knowing before you
add another. The NSO census carries no P-codes at all — hierarchy is a sequence
column and row position — and it is the only authoritative source below district
level, so there is no alternative. It matches on **(district, base name, unit
type)**, where the type comes from the name's own suffix and is *required to
agree* with the spine's `place_type`. That reaches 751 of 753 with zero type
disagreements; the last two are an explicit two-row seed
(`transform/seeds/nso_name_fixes.csv`) with a written reason each.

What makes that acceptable is the absence of cleverness. There is no edit
distance and no phonetic matching. `assert_nso_census_join_is_total` fails the
build if any area does not resolve. Open Knowledge Nepal's boundary release was
rejected for exactly the opposite reason: no P-codes *and* an independent
romanisation disagreeing with ours on 222 of 753 units, which only a guessing
matcher could bridge.

## Testing discipline

**Consistency checks are not enough.** Everything can agree and still be
uniformly wrong. Two real examples from this codebase:

- The COD-PS top age band is spelled `80Plus`. The ingest regex expected
  `80PL`, so 262,948 people over 80 were dropped. Place counts were correct,
  and the national/province/district hierarchy still reconciled — because every
  file was missing the same cohort. It was caught by *rendering the chart and
  counting the bars*.
- The name crosswalk produced 755 rows for 753 places because Wikidata holds
  several items for some places. Caught by a uniqueness test.

So: **assert against externally known expectations**, not just internal
agreement. 7 provinces, 77 districts, 753 local units, 54 measures per place.
When a source changes shape, fail loudly at ingestion.

**A partial load is the failure mode to fear.** It raises no error and produces
no obviously wrong row count — it just quietly under-reports, and so does every
per-capita figure derived from it.

## Frontend

Static export only (`output: "export"`). No server, no runtime data fetching.

**Read Parquet, not JSON, at build time.** JSON was fine at 4,590 observations
and breaks at ward scale (6,743 wards × indicators × years).

**URLs are hierarchical** (`/np/bagmati/kathmandu/`) because it is required for
correctness: 22 local-unit names are shared across districts, and slugs are
unique only within a parent.

**Never present projections as census counts.** Both are published now: NSO's
2021 census (29,164,578, `status = 'actual'`, `period_type = 'instant'`) and
UNFPA's 2023 projections (`status = 'projection'`). Every figure carries its
status and a place profile warns when one section mixes reference periods —
dividing 2023 population by 2021 households gives 4.0 people per household
instead of 3.75, and each figure is individually correct.

**Local units are 753 pages, not a rounding error.** Census population and
literacy are published for every one. A partial geography load is the failure
this platform is most exposed to, so CI checks the local-government page count
is *exactly* 753 rather than at least something.

**Institutional population belongs to no local unit.** Each district reports
239,098 people nationally who live in barracks, hostels, prisons and hospitals.
It is carried as `residence_type = institutional` at district level. Local units
therefore sum to 28,925,480, not to the national total, and
`assert_census_local_units_reconcile` is what makes that an accounting identity
rather than a silent shortfall.

**Run `npm run palette` before changing any colour**, rather than reasoning
about contrast. `web/scripts/check-palette.mjs` checks categorical slots for
CVD separation, sequential ramps for lightness monotonicity, and grouping tints
for label contrast. It is wired into `npm run check`, and it has already caught
a blue-on-blue pair that landed on the Bagmati/Gandaki border.

**Look at the rendered page.** Status codes and geometry checks do not tell you
whether something looks right. Use the Chrome DevTools MCP.

## Adding a dataset

0. Check `robots.txt`, and check whether the data is already inside a file you
   download. Local-unit geometry sat in the COD archive we had been fetching
   monthly; a crosswalk was nearly built before anyone looked.
1. Connector in `ingestion/sources/`, registered in `ingestion/run.py`
2. Declare raw tables in `transform/models/staging/_sources.yml`
3. Staging model — rename, type, trim; no joins
4. Conform to the spine (P-code, or a tested crosswalk)
5. Union into `int_observations` in the canonical shape
6. Mart + tests
7. `catalog/datasets/<table>.yml`, or the export rejects it

Step 4 is the one that matters. A dataset that does not conform to the spine
cannot be joined against anything, which defeats the point of centralising it.

## Environment notes

Behind a TLS-inspecting corporate proxy:

```bash
export UV_NATIVE_TLS=1
export REQUESTS_CA_BUNDLE=~/.certs/corporate-ca-bundle.pem
```

`httpx` ignores those variables by default — connectors call a `_verify()`
helper that honours them. Follow that pattern in new connectors.

Pin `dbt-core` below 1.10. Python 3.12 (3.14 breaks dbt).

## Deployment

Cloudflare Pages builds `web/` from this repo on push; `publish/dist` is
committed so the build needs Node only. GitHub Actions refreshes data monthly
and commits `publish/dist` if tests pass. **No deploy credentials in this repo.**
