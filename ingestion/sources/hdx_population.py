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
import os
import re
from collections.abc import Iterator
from typing import Any

import dlt
import httpx

logger = logging.getLogger(__name__)

HDX_PACKAGE_API = "https://data.humdata.org/api/3/action/package_show?id=cod-ps-npl"

# Column names encoding a sex/age-band measure, e.g. F_TL, M_00_04, T_80PL.
MEASURE = re.compile(r"^(?P<sex>[FMT])_(?P<age>TL|\d{2}_\d{2}|\d{2}PL)$", re.I)

EXPECTED_ROWS = {0: 1, 1: 7, 2: 77}


def _verify() -> str | bool:
    for var in ("REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"):
        path = os.getenv(var)
        if path and os.path.exists(path):
            return path
    return True


def _resources() -> dict[int, str]:
    """Map admin level -> CSV download URL for the latest year available."""
    response = httpx.get(HDX_PACKAGE_API, timeout=60, follow_redirects=True, verify=_verify())
    response.raise_for_status()
    payload = response.json()
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
    if age.endswith("PL"):
        return f"{int(age[:-2])}+"
    lo, hi = age.split("_")
    return f"{int(lo)}-{int(hi)}"


@dlt.resource(name="population", write_disposition="replace")
def population() -> Iterator[dict[str, Any]]:
    """Yield population counts in long form: one row per place/year/sex/age band."""
    emitted_by_level: dict[int, set[str]] = {}

    for level, url in sorted(_resources().items()):
        logger.info("Fetching COD-PS admin level %d", level)
        response = httpx.get(url, timeout=120, follow_redirects=True, verify=_verify())
        response.raise_for_status()

        # The files carry a UTF-8 BOM, which otherwise corrupts the first header.
        text = response.content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        places: set[str] = set()

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
        logger.info("  admin level %d: %d places", level, len(places))

    problems = [
        f"level {lvl}: {len(emitted_by_level.get(lvl, ()))} places (expected {n})"
        for lvl, n in EXPECTED_ROWS.items()
        if lvl in emitted_by_level and len(emitted_by_level[lvl]) != n
    ]
    if problems:
        raise ValueError("COD-PS coverage unexpected: " + "; ".join(problems))


@dlt.source(name="hdx_population")
def hdx_population_source():
    return [population()]
