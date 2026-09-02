"""Nepal administrative boundary geometry — OCHA COD via HDX.

Source: https://data.humdata.org/dataset/cod-ab-npl
Licence: CC BY-IGO
Publisher: OCHA Field Information Services Section

The same package that provides the tabular admin units also ships boundary
geometry, at all three admin levels. It is large: 58 MB zipped, and as raw
GeoJSON 6.4 MB for 7 provinces, 16 MB for 77 districts and 45 MB for the 775
local units and protected areas -- a vertex density meant for GIS analysis
rather than a 900px-wide web map.

Level 3 is here rather than from a third-party republisher for one reason: it
carries `adm3_pcode`, so it joins the spine by construction. Open Knowledge
Nepal publishes the same boundaries under CC BY 4.0 with no P-codes, and their
names are an independent romanisation that disagrees with ours on 222 of 753
units (Kedarseu/Kedarsyun, Purchaudi/Puchaundi, Sitganga/Shitaganga). Closing
that gap would mean guessing at transliterations, which is exactly what this
project refuses to do.

Shipping that to a browser would be absurd, so geometry is simplified here with
Ramer-Douglas-Peucker at a tolerance chosen per admin level. At the sizes these
render, 0.004 degrees is below one screen pixel:

    provinces      161,502 vertices ->   3,028
    districts      far more         ->   5,520
    local units  1,082,163 vertices ->  54,103

Simplification happens at ingestion, not in the browser, because the browser
should never receive data it cannot use. Tiny rings -- river islands, slivers --
are dropped entirely: they are invisible at display size and cost bytes.

Coordinates stay as lon/lat. Projection is the frontend's business, and baking
a projection in here would tie the data to one map size forever.
"""

from __future__ import annotations

import io
import json
import logging
import math
import sys
import zipfile
from collections.abc import Iterator
from typing import Any

import dlt

from ingestion import http

logger = logging.getLogger(__name__)

HDX_PACKAGE_API = "https://data.humdata.org/api/3/action/package_show?id=cod-ab-npl"

# Tolerance in degrees, per admin level.
#
# Not a single global value, because each level is drawn at a different scale.
# Provinces and districts are drawn as a whole country, so a district is a small
# fraction of the frame. Local units are drawn a district at a time -- ten or
# twenty shapes filling the frame -- so each one occupies far more pixels and
# needs correspondingly finer geometry.
#
# Measured rather than guessed. At level 3, tolerance 0.0015 keeps 54,103 of
# 1,082,163 vertices, averaging 1.4 KB of GeoJSON per unit, and drops no rings
# at all. A district page renders only its own units, so the cost that matters
# is roughly 25 KB for an eighteen-unit district, not the 1 MB total.
TOLERANCE = {1: 0.004, 2: 0.006, 3: 0.0015}

# Rings smaller than this (in square degrees) are dropped. At Nepal's latitude
# one square degree is roughly 12,000 km², so this discards anything under
# about 1 km² -- invisible on a web map.
MIN_RING_AREA = 1e-4

# Externally known counts, asserted rather than trusted. Level 3 is 775: the 753
# local units plus 22 protected areas, which the P-code type digit distinguishes
# (5 = protected area). A source that changes shape must fail loudly here rather
# than quietly under-reporting.
EXPECTED = {1: 7, 2: 77, 3: 775}



def _perp_distance(
    p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]
) -> float:
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def _simplify(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker, iterative to avoid deep recursion on long rings."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        dmax, idx = 0.0, start
        for i in range(start + 1, end):
            d = _perp_distance(points[i], points[start], points[end])
            if d > dmax:
                dmax, idx = d, i
        if dmax > eps:
            keep[idx] = True
            stack.append((start, idx))
            stack.append((idx, end))
    return [p for p, k in zip(points, keep, strict=True) if k]


def _ring_area(ring: list[tuple[float, float]]) -> float:
    """Shoelace area, unsigned, in square degrees."""
    total = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def _simplify_geometry(geometry: dict, eps: float) -> dict | None:
    """Simplify a Polygon or MultiPolygon, dropping negligible rings."""
    polygons = (
        geometry["coordinates"]
        if geometry["type"] == "MultiPolygon"
        else [geometry["coordinates"]]
    )

    out: list[list[list[list[float]]]] = []
    for polygon in polygons:
        rings: list[list[list[float]]] = []
        for i, ring in enumerate(polygon):
            pts = [(float(c[0]), float(c[1])) for c in ring]
            if len(pts) < 4 or _ring_area(pts) < MIN_RING_AREA:
                # Drop the whole polygon if its outer ring is negligible; drop
                # only the hole if an inner ring is.
                if i == 0:
                    rings = []
                    break
                continue
            simplified = _simplify(pts, eps)
            # A ring needs at least three distinct points plus closure.
            if len(simplified) < 4:
                continue
            if simplified[0] != simplified[-1]:
                simplified.append(simplified[0])
            rings.append([[round(x, 5), round(y, 5)] for x, y in simplified])
        if rings:
            out.append(rings)

    if not out:
        return None
    return {"type": "MultiPolygon", "coordinates": out}


def _geojson_url() -> str:
    payload = http.get_json(HDX_PACKAGE_API, what="HDX boundaries package_show", timeout=60)
    if not payload.get("success"):
        raise RuntimeError("HDX package_show returned success=false")
    for res in payload["result"]["resources"]:
        if res.get("format") == "GeoJSON":
            return res["url"]
    raise RuntimeError("No GeoJSON resource in the COD-AB package")


@dlt.resource(name="boundaries", write_disposition="replace", primary_key="pcode")
def boundaries() -> Iterator[dict[str, Any]]:
    """Yield simplified boundary geometry for provinces and districts."""
    sys.setrecursionlimit(20000)
    url = _geojson_url()
    logger.info("Fetching COD boundary geometry (large; ~58 MB)")

    response = http.get(url, what="COD boundary geometry (~58 MB)", timeout=600)

    counts: dict[int, int] = {}
    vertices: dict[int, int] = {}

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        for level, eps in TOLERANCE.items():
            name = next(
                (
                    n
                    for n in archive.namelist()
                    # The plain layer, not the "_em" edge-matched variant.
                    if n.endswith(f"npl_admin{level}.geojson")
                ),
                None,
            )
            if name is None:
                raise RuntimeError(f"npl_admin{level}.geojson not found in the archive")

            data = json.loads(archive.read(name))
            counts[level] = 0
            vertices[level] = 0

            for feature in data["features"]:
                props = feature["properties"]
                pcode = props.get(f"adm{level}_pcode")
                if not pcode:
                    continue
                geom = _simplify_geometry(feature["geometry"], eps)
                if geom is None:
                    logger.warning("All rings dropped for %s; skipping", pcode)
                    continue

                counts[level] += 1
                vertices[level] += sum(len(r) for poly in geom["coordinates"] for r in poly)
                yield {
                    "pcode": pcode,
                    "admin_level": level,
                    "name_en": props.get(f"adm{level}_name"),
                    # Stored as a JSON string: a nested coordinate array is
                    # awkward to type through the warehouse, and every consumer
                    # wants it as GeoJSON anyway.
                    "geometry": json.dumps(geom, separators=(",", ":")),
                }

            logger.info(
                "  admin level %d: %d features, %s vertices after simplification",
                level, counts[level], f"{vertices[level]:,}",
            )

    problems = [
        f"level {lvl}: {counts.get(lvl, 0)} features (expected {n})"
        for lvl, n in EXPECTED.items()
        if counts.get(lvl, 0) != n
    ]
    if problems:
        raise ValueError("Boundary coverage unexpected: " + "; ".join(problems))


@dlt.source(name="hdx_boundaries")
def hdx_boundaries_source():
    return [boundaries()]
