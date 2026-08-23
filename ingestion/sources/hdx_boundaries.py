"""Nepal administrative boundary geometry — OCHA COD via HDX.

Source: https://data.humdata.org/dataset/cod-ab-npl
Licence: CC BY-IGO
Publisher: OCHA Field Information Services Section

The same package that provides the tabular admin units also ships boundary
geometry. It is large: 58 MB zipped, 6.1 MB for 7 provinces and 15 MB for 77
districts as raw GeoJSON, at a vertex density meant for GIS analysis rather
than a 900px-wide web map.

Shipping that to a browser would be absurd, so geometry is simplified here with
Ramer-Douglas-Peucker at a tolerance chosen per admin level. At the sizes these
render, 0.004 degrees is below one screen pixel:

    provinces   161,502 vertices -> ~3,000   (~30 KB)
    districts   far more         -> ~9,000   (~90 KB)

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
import os
import sys
import zipfile
from collections.abc import Iterator
from typing import Any

import dlt
import httpx

logger = logging.getLogger(__name__)

HDX_PACKAGE_API = "https://data.humdata.org/api/3/action/package_show?id=cod-ab-npl"

# Tolerance in degrees, per admin level. Provinces render largest so they get
# the finest tolerance; districts are drawn smaller and individually.
TOLERANCE = {1: 0.004, 2: 0.006}

# Rings smaller than this (in square degrees) are dropped. At Nepal's latitude
# one square degree is roughly 12,000 km², so this discards anything under
# about 1 km² -- invisible on a web map.
MIN_RING_AREA = 1e-4

EXPECTED = {1: 7, 2: 77}


def _verify() -> str | bool:
    for var in ("REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"):
        path = os.getenv(var)
        if path and os.path.exists(path):
            return path
    return True


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
    response = httpx.get(HDX_PACKAGE_API, timeout=60, follow_redirects=True, verify=_verify())
    response.raise_for_status()
    payload = response.json()
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

    response = httpx.get(url, timeout=600, follow_redirects=True, verify=_verify())
    response.raise_for_status()

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
