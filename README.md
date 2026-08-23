# DataNepal

Nepal's public data, centralized: one platform for ingesting, conforming, and
publishing national datasets.

Nepal's public statistics are scattered across government sites that each use
their own geography codes, formats, and update cadences — so questions that
span two datasets are far harder to answer than they should be. This project
conforms them against a shared geographic spine and publishes the result as
open, documented, downloadable data.

## Status

Live at **[datanepal.org](https://datanepal.org)** — 86 static pages covering
7 provinces and 77 districts.

| Dataset | Status |
|---|---|
| Administrative geography | **live** — 753 local units, 77 districts, 7 provinces |
| Population (COD-PS) | **live** — country/province/district, by sex and age band |
| Protected areas | **live** — 22 national parks and reserves |
| Voter roll aggregates | not used — source disallows crawling, see below |
| Palika-level population | needs the NSO census portal; COD-PS stops at district |
| Economic indicators (NRB) | planned |

### How it deploys

```
GitHub Actions  ingest -> dbt build + test -> export -> commit publish/dist
Cloudflare Pages  watches the repo -> npm run build in web/ -> datanepal.org
```

`publish/dist` is committed on purpose: it gives the published data a version
history, and it lets Pages build with Node alone rather than running the whole
Python pipeline in its build image. No deploy credentials live in this repo.

## Design

```
sources → ingestion (dlt) → warehouse (DuckDB) → transform (dbt) → publish (static Parquet/JSON)
```

Four decisions shape everything else:

**Aggregates only, never individual records.** This platform does not ingest,
store, or publish personal data. The voter roll connector fetches counts, not
voters. This is a hard constraint, not a default — see [Personal data](#personal-data).

**Geography is the spine.** Every dataset joins to one canonical
province/district/palika table. Nepali sources key geography inconsistently, and
the 2017 federal restructuring rewrote local boundaries, so conforming once is
what makes cross-dataset questions answerable.

**No API server.** Published data is static Parquet and JSON on a CDN, queried
client-side with DuckDB-WASM. Nepal's aggregate data is tens of megabytes —
small enough to ship to the browser. Nothing to operate, nothing to attack,
nothing to fall over.

**Provenance is mandatory.** Every published table needs a catalog entry stating
source, licence, vintage, and caveats. `publish/export.py` refuses to publish a
table without one. Data nobody can cite is data nobody should trust.

## Layout

```
ingestion/       dlt connectors, one module per source
transform/       dbt project (staging → intermediate → marts)
publish/         export marts to static Parquet/JSON
catalog/         dataset provenance metadata + JSON schema
tests/           catalog validation
```

## Quick start

Requires Python 3.12 and [uv](https://docs.astral.sh/uv/).

```bash
uv venv .venv --python 3.12
uv pip install -e ".[dev]"
cd transform && ../.venv/bin/dbt deps && cd ..

# Ingest geography (one licensed 243KB download from HDX)
.venv/bin/python -m ingestion.run --source hdx_admin

# Build and test
cd transform && ../.venv/bin/dbt build --profiles-dir . && cd ..

# Publish to publish/dist/
.venv/bin/python -m publish.export
```

Or just `make setup && make all`.

## Join keys

Everything keys on **OCHA P-codes**, which are hierarchical and positional:

```
NP 03 27 1 01
│  │  │  │  └─ sequence within district
│  │  │  └──── local unit type (1 metro, 2 sub-metro, 3 municipality,
│  │  │                        4 rural municipality, 5 protected area)
│  │  └─────── district
│  └────────── province
└───────────── country
```

A child's code is prefixed by its parent's, so hierarchy joins are substring
operations rather than lookups. The type digit classifies authoritatively,
which avoids matching on Nepali name suffixes — those nest as substrings
(`उपमहानगरपालिका` contains `महानगरपालिका`) and misclassify silently.

Nepal has no universal local-unit identifier, so other sources reach this
spine through **crosswalk tables**, never by name matching. English/Nepali
transliteration is not standardised and will not join reliably. Crosswalks are
built by matching on (district, normalised name), then geometry via
point-in-polygon, then hand-verifying the residue — and are tested for being
1:1 and total.

## A note on the Election Commission

An earlier connector scraped `voterlist.election.gov.np`. That source is not
used, for two reasons:

- Its `robots.txt` is `Disallow: /` for all agents, and the application sets
  `noindex, nofollow, noarchive`. It asks automated clients to stay away.
- Nepal's Privacy Act 2075 (2018) names voter identity card details as
  protected personal information.

The connector remains in `ingestion/sources/` unregistered, as a record of the
site's structure. Do not run it against the live site.

## Adding a dataset

1. Write a dlt connector in `ingestion/sources/`, register it in `ingestion/run.py`
2. Declare the raw tables in `transform/models/staging/_sources.yml`
3. Add a staging model — rename, type, trim; no joins
4. Union its geography into `int_geography` so it shares the spine
5. Build a mart, add tests
6. Write `catalog/datasets/<table>.yml` — the export will reject it otherwise

Step 4 is the one that matters. A dataset that doesn't conform to the spine
can't be joined against anything, which defeats the point of centralizing it.

## Personal data

This platform publishes aggregates. It does not publish personal data.

That constraint exists for a concrete reason. The predecessor project served an
unauthenticated endpoint returning names, voter ID numbers, ages, and parents'
and spouses' names for any municipality in Nepal — the full national roll,
enumerable by anyone. It has been removed.

Practical consequences for contributors:

- Connectors fetch counts, not records. Do not add row-level extraction.
- `.gitignore` blocks voter-roll files. Do not commit source data with personal
  information, even temporarily — git history is forever.
- Every catalog entry asserts `contains_personal_data: false`, and the schema
  requires it to be false. It's an explicit statement, not an assumption.
- If a source only offers row-level data, aggregate it at ingestion and discard
  the rows. Aggregation belongs before storage, not after.

## Network-restricted environments

Behind a TLS-inspecting corporate proxy, some tooling needs help:

```bash
export UV_NATIVE_TLS=1                                    # uv uses the system trust store
export REQUESTS_CA_BUNDLE=/path/to/corporate-ca-bundle.pem  # dbt deps
```

DuckDB's `httpfs` and `spatial` extensions download on first use and will fail
the same way; pre-install them with `duckdb -c "install httpfs; install spatial;"`
from an unrestricted network. Parquet and JSON are built in and need nothing.

## Licence

Code: MIT (see `LICENSE`).

Published data: each dataset carries its own licence in its catalog entry.
Where a source states none, it is recorded as `unknown` rather than guessed —
check the catalog before reusing.
