# ADR-0001: Static-first deployment

**Status:** Accepted · 2026-08-23

## Context

DataNepal publishes aggregate public statistics. The predecessor project served
the same domain from a 2 GB DigitalOcean droplet running ClickHouse and a
FastAPI application.

That arrangement failed in three ways within a single day of investigation:
ClickHouse was OOM-killed and took the API down with it; ClickHouse's HTTP port
was exposed to the internet; and the API served row-level personal data without
authentication because a token check short-circuited when the token was unset.

The published aggregate data is currently 3.7 MB.

## Decision

Publish static Parquet and JSON to a CDN. Generate every page at build time. Run
no application server and no database in production.

The warehouse (DuckDB) is a build artefact, rebuilt from scratch each run. The
persistent state is two committed files: `publish/dist/` and
`history/observation_history.parquet`.

## Consequences

**Good.** Nothing to operate, nothing to OOM, no database reachable from the
internet, no per-request cost, and no equivalent of the failure that leaked
personal data. Cloudflare Pages absorbs any traffic the site will plausibly see.

**Costs.** No arbitrary user queries, no custom exports, no metered API. Whole
tables ship to the client or the build rather than being queried remotely.
Cloudflare Pages caps a deployment at 20,000 files, which bounds page count.

**Reversal cost.** Moderate and one-directional. Adding a read API over the same
Parquet is additive; the static layer keeps working. Making a database the source
of truth would be the expensive reversal, and is explicitly rejected.

## Triggers for revisiting

Deployment exceeding ~20,000 files; build exceeding ~15 minutes; users needing
queries that cannot be precomputed; committed data exceeding ~100 MB; or a paid
API requiring auth, metering, or rate limiting. DuckDB-WASM in the browser is
the first answer to query flexibility, before any server.
