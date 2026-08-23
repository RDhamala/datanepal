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
never by name matching. Crosswalks must be tested 1:1 and total.

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

**Never present projections as census counts.** Population figures are 2023
projections; Nepal's last census was 2021 (29,164,578). The distinction is
exactly the kind of thing that destroys trust in a data platform.

**Read the `dataviz` skill before writing any chart code**, and run its palette
validator rather than reasoning about colour contrast.

**Look at the rendered page.** Status codes and geometry checks do not tell you
whether something looks right. Use the Chrome DevTools MCP.

## Adding a dataset

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
