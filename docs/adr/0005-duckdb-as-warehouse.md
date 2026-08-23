# ADR-0005: DuckDB as the analytical warehouse

**Status:** Accepted · 2026-08-23

## Context

The transformation layer needs SQL, joins across sources, and a testing
framework. The predecessor used ClickHouse on a 2 GB droplet, where it was
OOM-killed twice and exposed its HTTP interface to the internet.

Published data is currently 3.7 MB. At ward level with several datasets it might
reach a few hundred megabytes.

## Decision

DuckDB, embedded, as an ephemeral build artefact. dbt-duckdb for transformation,
lineage, and tests. Parquet as the publication format.

The warehouse file is gitignored and rebuilt from scratch on every run.

## Consequences

**Good.** No server, no ports, no memory tuning, no OOM. The whole warehouse is
one file, so a contributor reproduces the entire pipeline with `make all`. Native
Parquet read and write, so publication is a `COPY`. Excellent columnar
performance at this scale, and honestly at a hundred times this scale.

**Costs.** No concurrent writers, so the pipeline is single-writer by
construction — currently a feature. No persistence between runs, which is why
revision history needs its own mechanism (ADR-0004) and why `place_id` is derived
by hash rather than a sequence (ADR-0002). Both consequences shaped other
decisions, which is worth noting: an embedded ephemeral warehouse is not a free
choice.

**Reversal cost.** Low. dbt models are mostly portable SQL; the DuckDB-specific
parts are `struct_pack`, `list_sort`, and `unnest`. Moving to Postgres or
DuckDB-in-a-server would be a rewrite of a handful of models, not the platform.

## Alternatives rejected

**ClickHouse:** the predecessor's choice, and the thing that fell over. Enormous
operational weight for data that fits in RAM.

**Postgres:** a server to operate, for no benefit at this scale. Becomes
interesting only if a write path appears — an admin console, user accounts.

**Pandas or Polars scripts without dbt:** loses lineage, tests, and
documentation, which is most of the value. The tests in this project have caught
several real data bugs.
