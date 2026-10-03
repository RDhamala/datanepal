"""Nepal administrative boundaries — OCHA Common Operational Dataset via HDX.

Source: https://data.humdata.org/dataset/cod-ab-npl
Licence: CC BY-IGO
Publisher: OCHA Field Information Services Section

This is the geography spine's source of truth. It is preferred over scraping
the Election Commission for three reasons: it is openly licensed and explicitly
published for reuse, it carries stable hierarchical P-codes, and it ships
boundary geometry. The Election Commission's voter-search application sets
`Disallow: /` for all crawlers, so it is not a legitimate source regardless.

P-code structure is positional and self-describing:

    NP 03 27 1 01
    │  │  │  │  └── sequence within district
    │  │  │  └───── local unit type (see UNIT_TYPES)
    │  │  └──────── district
    │  └─────────── province
    └────────────── country

A child's P-code is prefixed by its parent's, so hierarchy joins need no
lookup table. The type digit gives authoritative classification, which avoids
matching on Nepali name suffixes -- those nest as substrings and misclassify
silently.

Type 5 is protected areas (national parks, reserves). They are NOT local units:
they sit outside palika jurisdiction under federal administration, and several
span multiple districts. Excluding them is what makes the count 753 rather
than 775.
"""

from __future__ import annotations

import io
import logging
from collections.abc import Iterator
from typing import Any

import dlt
import openpyxl

from ingestion import http

logger = logging.getLogger(__name__)

HDX_PACKAGE_API = "https://data.humdata.org/api/3/action/package_show?id=cod-ab-npl"



UNIT_TYPES = {
    "1": "metropolitan",
    "2": "sub_metropolitan",
    "3": "municipality",
    "4": "rural_municipality",
    "5": "protected_area",
}

# Official counts per Nepal's federal structure. Asserted at ingestion so a
# changed upstream file fails here rather than silently skewing every
# per-capita figure computed downstream.
EXPECTED_LOCAL_UNITS = 753
EXPECTED_DISTRICTS = 77
EXPECTED_PROVINCES = 7


def _resource_url(fmt: str = "XLSX") -> str:
    """Resolve the current download URL from HDX's API.

    Resource URLs embed revision IDs and change when OCHA republishes, so
    hardcoding one guarantees a stale or broken fetch later.
    """
    payload = http.get_json(HDX_PACKAGE_API, what="HDX admin package_show", timeout=30)
    if not payload.get("success"):
        raise RuntimeError("HDX package_show returned success=false")

    for resource in payload["result"]["resources"]:
        if resource.get("format") == fmt:
            return resource["url"]
    raise RuntimeError(f"No {fmt} resource found in the HDX package")


def _rows(sheet) -> tuple[list[str], list[tuple]]:
    rows = list(sheet.iter_rows(values_only=True))
    header = [str(c) if c else "" for c in rows[0]]
    data = [r for r in rows[1:] if r and r[0]]
    return header, data


@dlt.resource(name="admin_units", write_disposition="replace", primary_key="pcode")
def admin_units() -> Iterator[dict[str, Any]]:
    """Yield every admin level 1-3 unit with its P-code lineage.

    Emits provinces, districts, and local units (plus protected areas) as one
    stream with an `admin_level` discriminator, so downstream models can pivot
    or filter rather than reconciling three differently-shaped tables.
    """
    url = _resource_url("XLSX")
    logger.info("Fetching HDX admin boundaries from %s", url)

    response = http.get(url, what="HDX admin boundaries XLSX", timeout=180)
    workbook = openpyxl.load_workbook(io.BytesIO(response.content), read_only=True)

    # --- Provinces -------------------------------------------------------
    header, data = _rows(workbook["npl_admin1"])
    ix = {name: header.index(name) for name in ("adm1_pcode", "adm1_name", "area_sqkm")}
    province_count = 0
    for row in data:
        province_count += 1
        yield {
            "admin_level": 1,
            "pcode": row[ix["adm1_pcode"]],
            "name_en": row[ix["adm1_name"]],
            "parent_pcode": "NP",
            "unit_type": "province",
            "area_sqkm": row[ix["area_sqkm"]],
        }

    # --- Districts -------------------------------------------------------
    header, data = _rows(workbook["npl_admin2"])
    ix = {
        name: header.index(name)
        for name in ("adm2_pcode", "adm2_name", "adm1_pcode", "area_sqkm")
    }
    district_count = 0
    for row in data:
        district_count += 1
        yield {
            "admin_level": 2,
            "pcode": row[ix["adm2_pcode"]],
            "name_en": row[ix["adm2_name"]],
            "parent_pcode": row[ix["adm1_pcode"]],
            "unit_type": "district",
            "area_sqkm": row[ix["area_sqkm"]],
        }

    # --- Local units and protected areas ---------------------------------
    header, data = _rows(workbook["npl_admin3"])
    ix = {
        name: header.index(name)
        for name in (
            "adm3_pcode",
            "adm3_name",
            "adm2_pcode",
            "area_sqkm",
            "center_lat",
            "center_lon",
        )
    }
    local_unit_count = 0
    for row in data:
        pcode = row[ix["adm3_pcode"]]
        unit_type = UNIT_TYPES.get(pcode[6], "unknown")
        if unit_type == "unknown":
            logger.warning("Unrecognised type digit in P-code %s", pcode)
        if unit_type != "protected_area":
            local_unit_count += 1

        yield {
            "admin_level": 3,
            "pcode": pcode,
            "name_en": row[ix["adm3_name"]],
            "parent_pcode": row[ix["adm2_pcode"]],
            "unit_type": unit_type,
            "area_sqkm": row[ix["area_sqkm"]],
            "center_lat": row[ix["center_lat"]],
            "center_lon": row[ix["center_lon"]],
        }

    # Fail loudly on an incomplete or restructured upstream file. A partial
    # load produces no error downstream -- just quietly wrong statistics.
    problems = []
    if province_count != EXPECTED_PROVINCES:
        problems.append(f"{province_count} provinces (expected {EXPECTED_PROVINCES})")
    if district_count != EXPECTED_DISTRICTS:
        problems.append(f"{district_count} districts (expected {EXPECTED_DISTRICTS})")
    if local_unit_count != EXPECTED_LOCAL_UNITS:
        problems.append(
            f"{local_unit_count} local units (expected {EXPECTED_LOCAL_UNITS})"
        )
    if problems:
        raise ValueError(
            "HDX admin boundaries do not match Nepal's federal structure: "
            + "; ".join(problems)
            + ". Verify upstream before trusting this load."
        )

    logger.info(
        "Loaded %d provinces, %d districts, %d local units",
        province_count,
        district_count,
        local_unit_count,
    )


@dlt.source(name="hdx_admin")
def hdx_admin_source():
    return [admin_units()]
