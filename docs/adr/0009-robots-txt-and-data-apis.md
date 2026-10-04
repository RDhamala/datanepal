# ADR-0009: `robots.txt` governs crawling, not documented data APIs

**Status:** Accepted · 2026-10-04 · Refines the hard constraint in [CLAUDE.md](../../CLAUDE.md)

## Context

CLAUDE.md states, as a hard constraint learned the expensive way:

> **Check `robots.txt` before writing any connector.**
> `voterlist.election.gov.np` is `Disallow: /` for all agents. Prefer sources
> published for reuse over sources that merely happen to be reachable.

Extending the Wikidata connector to collect district names meant checking that
rule, and the check turned up something uncomfortable: three connectors already
in production touch paths their host's `robots.txt` disallows.

| Host | Directive | What we call |
|---|---|---|
| `query.wikidata.org` | `Disallow: /sparql` | `wikidata_names.py` → `/sparql` |
| `data.humdata.org` | `Disallow: /api/` | `hdx_admin.py`, `hdx_boundaries.py`, `hdx_population.py` → the CKAN API, to resolve a resource URL |
| `data.humdata.org` | `Disallow: /*.xlsx$` | the same connectors, to download the file the API points at |

Read literally, the rule forbids the pipeline this platform is built on. That
reading cannot be right, but neither can "the rule is inconvenient, ignore it" —
the rule exists because a predecessor project served an unauthenticated endpoint
of voter records, and the robots.txt check is one of the things standing between
this project and that one.

## Decision

**`robots.txt` is a crawler directive. It governs automated discovery of a site
by following links; it does not govern a client fetching a specific, documented
resource that the publisher offers for reuse.**

A source is in bounds when all of the following hold:

1. **The data is published for reuse**, with a licence that says so. HDX's CODs
   are CC BY-IGO and exist to be downloaded. Wikidata is CC0.
2. **The access path is the documented one.** HDX maintains `hdx-python-api`,
   whose entire job is calling the CKAN API that `robots.txt` disallows.
   Wikimedia operates WDQS as a public endpoint with a published user-agent
   policy and rate limits.
3. **We identify ourselves honestly.** `http.USER_AGENT` names the crawler and
   does not impersonate a browser.
4. **We fetch specific resources, not a crawl.** Monthly, a handful of URLs,
   no link-following, no discovery.

Where any of those fails, `robots.txt` is dispositive and the source is out.

## What this does not license

`voterlist.election.gov.np` remains forbidden, and the distinction is not a
close call:

- It serves `Disallow: /` — not "do not index this file type", but "do not
  access this site". There is no documented reuse API behind it.
- The data is **personal data**, which Nepal's Privacy Act 2075 protects and
  which this platform may never ingest under any licence or access path.

That second point is the load-bearing one. The robots.txt check was never the
real protection there; the personal-data constraint is, and it is absolute and
independent of this ADR.

Equally unchanged: OpenStreetMap stays rejected as a name source. Its licence is
ODbL and its share-alike terms would propagate to the published database — a
licensing decision ([ADR-0007](0007-licensing-boundaries.md)), not an access one.

## Consequences

- The three existing connectors are judged compliant, and
  `wikidata_names.district_names` joins them.
- `datanepal-source-research` should evaluate the four conditions above rather
  than treating any `Disallow` as a stop sign — and should still treat
  `Disallow: /` on a site with no reuse API as exactly that.
- A future reviewer who finds this tension gets the reasoning instead of having
  to re-derive it, which is the whole point of writing it down.

## Alternatives considered

**Take the rule literally and replace all three sources.** The compliant
substitutes are the Wikimedia dumps (`dumps.wikimedia.org` serves no
`robots.txt`, so everything is permitted) and whatever HDX offers outside
`/api/`. The Wikidata dump is ~100 GB compressed, to extract roughly 830
labels, in a monthly job. That is a large, fragile cost paid to satisfy a
directive aimed at search engines, and it would make the pipeline worse at
being honest, not better.

**Say nothing and extend the connector.** The tension is real and a reader who
notices it deserves an answer. Leaving a documented hard constraint quietly
contradicted by the code is how a rule stops being load-bearing.
