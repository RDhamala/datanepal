"""Nepal subnational population statistics — COD-PS via HDX.

Source: https://data.humdata.org/dataset/cod-ps-npl
Licence: CC BY-IGO
Publisher: UNFPA

The population companion to the COD administrative boundaries. Critically, it
is already P-coded, so it joins to the geography spine with no crosswalk and no
name matching -- the whole class of problem that makes Nepali data hard simply
does not arise for COD-sourced data.

Shape: one row per admin unit per year, ~62 columns wide. Three totals
(F_TL, M_TL, T_TL) and then 5-year age bands by sex (F_00_04, M_00_04, ...).
This is unpivoted into long form downstream; the wide layout is a spreadsheet
convention, not a useful model.

Coverage is adm0 (country), adm1 (province), and adm2 (district). There is no
adm3, so palika-level population needs the NSO census portal instead.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from collections.abc import Iterator
from typing import Any

import dlt

from ingestion import http

logger = logging.getLogger(__name__)

HDX_PACKAGE_API = "https://data.humdata.org/api/3/action/package_show?id=cod-ps-npl"

# Column names encoding a sex/age-band measure, e.g. F_TL, M_00_04, T_80Plus.
#
# The open-ended top band is spelled "80Plus" in the current files, but "80PL"
# and "80+" both appear in COD-PS files for other countries and in older Nepal
# vintages. Accept all three: an unmatched top band silently drops the entire
# elderly population, and nothing downstream would flag it.
MEASURE = re.compile(
    r"^(?P<sex>[FMT])_(?P<age>TL|\d{2}_\d{2}|\d{2}(?:PL|PLUS|\+))$",
    re.I,
)

EXPECTED_PLACES = {0: 1, 1: 7, 2: 77}

# 3 sexes x 18 bands (16 five-year bands + 80+ + the TL total) = 54 measures.
EXPECTED_MEASURES_PER_PLACE = 54



def _resources() -> dict[int, str]:
    """Map admin level -> CSV download URL for the latest year available."""
    payload = http.get_json(HDX_PACKAGE_API, what="HDX population package_show", timeout=60)
    if not payload.get("success"):
        raise RuntimeError("HDX package_show returned success=false")

    found: dict[int, tuple[str, str]] = {}
    for res in payload["result"]["resources"]:
        name = res.get("name") or ""
        if res.get("format") != "CSV":
            continue
        match = re.search(r"admpop_adm(\d)_(\d{4})\.csv$", name)
        if not match:
            continue
        level, year = int(match.group(1)), match.group(2)
        # Keep the most recent year per level.
        if level not in found or year > found[level][0]:
            found[level] = (year, res["url"])

    if not found:
        raise RuntimeError("No admpop CSV resources found in the COD-PS package")
    return {lvl: url for lvl, (_, url) in found.items()}


def _normalise_age(age: str) -> str:
    """Render age bands consistently: '00_04' -> '0-4', '80PL' -> '80+'."""
    age = age.upper()
    if age == "TL":
        return "all"
    match = re.match(r"^(\d{2})(?:PL|PLUS|\+)$", age)
    if match:
        return f"{int(match.group(1))}+"
    lo, hi = age.split("_")
    return f"{int(lo)}-{int(hi)}"


@dlt.resource(name="population", write_disposition="replace")
def population() -> Iterator[dict[str, Any]]:
    """Yield population counts in long form: one row per place/year/sex/age band."""
    emitted_by_level: dict[int, set[str]] = {}
    measures_seen: dict[int, int] = {}

    for level, url in sorted(_resources().items()):
        logger.info("Fetching COD-PS admin level %d", level)
        response = http.get(url, what=f"COD-PS admin level {level}", timeout=120)

        # The files carry a UTF-8 BOM, which otherwise corrupts the first header.
        text = response.content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        places: set[str] = set()
        measures = 0

        for row in reader:
            pcode = (
                row.get(f"ADM{level}_PCODE")
                or row.get(f"adm{level}_pcode")
                or ""
            ).strip()
            if not pcode:
                continue
            places.add(pcode)
            year = int(row.get("year") or row.get("Year") or 0)

            for column, raw in row.items():
                match = MEASURE.match((column or "").strip())
                if not match or raw in (None, "", "NA"):
                    continue
                try:
                    value = int(float(raw))
                except ValueError:
                    continue

                measures += 1
                yield {
                    "place_pcode": pcode,
                    "admin_level": level,
                    "year": year,
                    # T is both sexes combined, not a third category.
                    "sex": {"F": "female", "M": "male", "T": "all"}[
                        match.group("sex").upper()
                    ],
                    "age_band": _normalise_age(match.group("age")),
                    "population": value,
                }

        emitted_by_level[level] = places
        measures_seen[level] = measures
        logger.info(
            "  admin level %d: %d places, %d measures each",
            level, len(places), measures // max(len(places), 1),
        )

    problems = [
        f"level {lvl}: {len(emitted_by_level.get(lvl, ()))} places (expected {n})"
        for lvl, n in EXPECTED_PLACES.items()
        if lvl in emitted_by_level and len(emitted_by_level[lvl]) != n
    ]

    # Check measures per place as well as place counts. A renamed column -- the
    # top age band is spelled "80Plus" here but "80PL" elsewhere -- would
    # otherwise pass the place check while silently dropping a whole cohort.
    for lvl, count in measures_seen.items():
        n_places = len(emitted_by_level.get(lvl, ()))
        if not n_places:
            continue
        per_place = count / n_places
        if per_place != EXPECTED_MEASURES_PER_PLACE:
            problems.append(
                f"level {lvl}: {per_place:.1f} measures per place "
                f"(expected {EXPECTED_MEASURES_PER_PLACE}) -- a source column "
                "may have been renamed"
            )

    if problems:
        raise ValueError("COD-PS coverage unexpected: " + "; ".join(problems))


@dlt.source(name="hdx_population")
def hdx_population_source():
    return [population()]
