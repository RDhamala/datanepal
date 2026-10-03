"""Nepali names for Nepal's local units, from Wikidata.

Source: https://query.wikidata.org
Licence: CC0

The geography spine comes from the OCHA COD, which publishes English only. A
bilingual platform needs Nepali names for all 753 local units, and no single
source has them.

Wikidata is preferred over OpenStreetMap here on licensing grounds, not
coverage. OSM carries Nepali names for ~55% of units but is ODbL, whose
share-alike terms would propagate to any database derived from it -- awkward to
combine with the CC BY-IGO spine and constraining for anyone reusing our
output. Wikidata is CC0 and composes freely.

Items are found through the district relation (P131 -> an item that is an
instance of "district of Nepal"), which is more reliable than matching on type
classes: Wikidata types Nepal's local units inconsistently, and metropolitan
cities are often typed as the underlying city rather than the administrative
unit.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

import dlt

from ingestion import http

logger = logging.getLogger(__name__)

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
DISTRICT_OF_NEPAL = "Q2537537"

# Types that represent a local unit. Deliberately broad: Wikidata's typing is
# inconsistent, and over-collecting is safe because matching happens downstream
# against the spine, which is authoritative for what exists.
LOCAL_UNIT_TYPES = {
    "rural municipality of Nepal",
    "municipality of Nepal",
    "municipality",
    "city",
    "metropolitan city",
    "sub-metropolitan city",
}

QUERY = f"""
SELECT ?item ?en ?ne ?typeLabel ?districtLabel ?coord WHERE {{
  ?district wdt:P31 wd:{DISTRICT_OF_NEPAL} .
  ?item wdt:P131 ?district .
  ?item wdt:P31 ?type .
  OPTIONAL {{ ?item rdfs:label ?en   FILTER(lang(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?ne   FILTER(lang(?ne) = "ne") }}
  OPTIONAL {{ ?item wdt:P625 ?coord }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
"""


def _parse_point(wkt: str | None) -> tuple[float | None, float | None]:
    """Parse a WKT Point literal, e.g. 'Point(85.324 27.7172)'."""
    if not wkt or not wkt.startswith("Point("):
        return None, None
    try:
        lon, lat = wkt[6:-1].split()
        return float(lat), float(lon)
    except (ValueError, IndexError):
        return None, None


@dlt.resource(name="place_names", write_disposition="replace", primary_key="qid")
def place_names() -> Iterator[dict[str, Any]]:
    """Yield candidate local units with English and Nepali labels.

    Emits everything found, including entries missing one label or the other.
    Filtering belongs downstream where the spine can arbitrate; discarding here
    would hide coverage gaps that the transformation layer should report.
    """
    # Parsed inside the retry, not after it. This endpoint's failure mode is a
    # body that stops mid-string rather than a connection that drops -- the
    # request "succeeds" and json() is what raises. Retrying only the transport
    # would not have caught it.
    payload = http.get_json(
        SPARQL_ENDPOINT,
        what="Wikidata SPARQL place names",
        params={"query": QUERY},
        # Wikidata asks clients to identify themselves and will throttle or
        # block generic agents; http.USER_AGENT carries that identity.
        headers={"Accept": "application/sparql-results+json"},
        timeout=180,
    )
    bindings = payload["results"]["bindings"]
    logger.info("Wikidata returned %d candidate items", len(bindings))

    emitted = 0
    seen: set[str] = set()
    for row in bindings:
        unit_type = row.get("typeLabel", {}).get("value")
        if unit_type not in LOCAL_UNIT_TYPES:
            continue

        qid = row["item"]["value"].rsplit("/", 1)[-1]
        if qid in seen:
            continue
        seen.add(qid)

        lat, lon = _parse_point(row.get("coord", {}).get("value"))
        emitted += 1
        yield {
            "qid": qid,
            "name_en": row.get("en", {}).get("value"),
            "name_ne": row.get("ne", {}).get("value"),
            "wikidata_type": unit_type,
            "district_name_en": row.get("districtLabel", {}).get("value"),
            "lat": lat,
            "lon": lon,
        }

    logger.info("Emitted %d local unit candidates", emitted)
    if emitted < 400:
        # Wikidata occasionally times out and returns a partial result set with
        # a 200. A short read here would silently shrink name coverage.
        raise ValueError(
            f"Only {emitted} local units returned; expected several hundred. "
            "Likely a truncated Wikidata response -- retry before trusting this load."
        )


@dlt.source(name="wikidata_names")
def wikidata_names_source():
    return [place_names()]
