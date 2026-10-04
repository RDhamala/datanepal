"""Nepali names for Nepal's districts and local units, from Wikidata.

Source: https://query.wikidata.org
Licence: CC0

The geography spine comes from the OCHA COD, which publishes English only --
verified rather than assumed: the COD's XLSX carries adm1_name1/2/3 and
lang1/2/3 columns for exactly this purpose and every one of them is empty, with
`lang` declared "en". A bilingual platform needs Nepali names for 77 districts
and 753 local units, and no single source has them all.

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


# Abolished districts are excluded at the source, by Wikidata's own statement
# that they were dissolved (P576), not by us guessing which names look
# historical. Nepal's 2017 restructuring split Nawalparasi and Rukum in two;
# both parents still have items, and both sit inside one of their successors'
# boundaries, so a geometry match would confidently attach a dead district's
# name to a living one. Filtering on P576 leaves exactly 77 items for 77
# districts.
DISTRICT_QUERY = f"""
SELECT ?item ?en ?ne ?coord WHERE {{
  ?item wdt:P31 wd:{DISTRICT_OF_NEPAL} .
  OPTIONAL {{ ?item rdfs:label ?en FILTER(lang(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?ne FILTER(lang(?ne) = "ne") }}
  ?item wdt:P625 ?coord .
  FILTER NOT EXISTS {{ ?item wdt:P576 ?abolished }}
}}
"""


@dlt.resource(name="district_names", write_disposition="replace", primary_key="qid")
def district_names() -> Iterator[dict[str, Any]]:
    """Yield Nepal's districts with English and Nepali labels.

    The place_names query above already walks these items -- it binds ?district
    to find each local unit's parent -- and kept only the English label to
    disambiguate palika names. The districts' own Nepali labels were sitting one
    column away in a response we were already fetching, while all 77 district
    pages said "No Nepali name is published for this place".

    District names are unique nationally, where 22 local-unit names are shared
    across districts -- but that does not make the name sufficient. Wikidata's
    romanisation disagrees with the COD on ten of the 77: Dhanusa/Dhanusha,
    Kapilbastu/Kapilvastu, Terhathum/Tehrathum, and four post-2017 districts
    the two sources name entirely differently (our "Nawalparasi East" is their
    "Nawalpur"). That is the same failure that got Open Knowledge Nepal's
    boundary release rejected, so the coordinate is carried too and the
    transformation layer resolves the residue by geometry rather than by
    guessing at spellings.
    """
    payload = http.get_json(
        SPARQL_ENDPOINT,
        what="Wikidata SPARQL district names",
        params={"query": DISTRICT_QUERY},
        headers={"Accept": "application/sparql-results+json"},
        timeout=180,
    )
    bindings = payload["results"]["bindings"]

    emitted = 0
    seen: set[str] = set()
    for row in bindings:
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
            "lat": lat,
            "lon": lon,
        }

    logger.info("Emitted %d district candidates", emitted)
    # Nepal has exactly 77 districts, and with the abolished pair filtered out
    # this query returns exactly 77 items. Asserting the external expectation
    # rather than a floor: more than 77 means a district gained a duplicate
    # item or lost its P576, and fewer means a truncated response that still
    # returned 200.
    if emitted != 77:
        raise ValueError(
            f"Expected 77 current districts from Wikidata, got {emitted}. "
            "Either the response was truncated or Wikidata's set has changed; "
            "check before trusting this load."
        )


@dlt.source(name="wikidata_names")
def wikidata_names_source():
    return [place_names(), district_names()]
