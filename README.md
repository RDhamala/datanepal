# DataNepal

Nepal's public data, centralized: one platform for ingesting, conforming, and
publishing national datasets.

Nepal's public statistics are scattered across government sites that each use
their own geography codes, formats, and update cadences — so questions that
span two datasets are far harder to answer than they should be. This project
conforms them against a shared geographic spine and publishes the result as
open, documented, downloadable data.

## Status

Early. The pipeline runs end to end on fixture data; real sources are being
onboarded one at a time.

| Dataset | Status |
|---|---|
| Administrative geography | scaffolded, fixture data |
| Voter roll aggregates | connector written, not yet run |
| Census 2021 | planned |
| Economic indicators (NRB) | planned |

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

# Load fixture data (a full ingest hits a government server for ~an hour)
.venv/bin/python -m ingestion.fixtures

# Build and test
cd transform && ../.venv/bin/dbt build --profiles-dir . && cd ..

# Publish to publish/dist/
.venv/bin/python -m publish.export
```

Or just `make setup && make all`.

To run a real ingest instead of fixtures:

```bash
.venv/bin/python -m ingestion.run --source election_commission
```

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
