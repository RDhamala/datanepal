"""Export published tables to static files for CDN hosting.

Every mart becomes a Parquet file, plus JSON for tables small enough that a
client should not need a Parquet reader. A manifest describes the set.

The serving model is deliberately boring: static files on a CDN, queried by the
build or by the browser. No API server means nothing to operate, nothing to
OOM, no database exposed to the internet, and no per-request cost.

Two things are enforced here rather than documented:

  1. A table with no catalog entry is not published. Undocumented data that
     looks authoritative is worse than absent data.

  2. A table's **effective licence is computed** from the sources it draws on,
     never restated by hand. If a share-alike source ever feeds a table, the
     manifest says so, because the obligation travels with the data whether or
     not we mention it.

    python -m publish.export
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
ORGANISATIONS_CSV = ROOT / "transform" / "seeds" / "organisations.csv"
WAREHOUSE = ROOT / "warehouse" / "datanepal.duckdb"
TABLES_DIR = ROOT / "catalog" / "tables"
SOURCES_DIR = ROOT / "catalog" / "sources"
HISTORY = ROOT / "history" / "observation_history.parquet"

# dbt-duckdb prefixes custom schemas with the profile's default schema.
MARTS_SCHEMA = "main_marts"

# JSON alongside Parquet for tables a client can reasonably fetch whole.
JSON_ROW_LIMIT = 20_000

# Licence precedence when a table draws on several sources. The most
# restrictive wins, because that is the obligation a reuser actually inherits.
LICENCE_RANK = {
    "cc0-1.0": 0,
    "cc-by-4.0": 1,
    "cc-by-igo-3.0": 2,
    "gov-open": 3,
    "cc-by-sa-4.0": 4,
    "odbl-1.0": 5,
    "unknown": 6,
}


def load_organisations() -> dict[str, dict]:
    """The source registry, so provenance can resolve org ids to names."""
    import csv

    with ORGANISATIONS_CSV.open() as handle:
        return {row["org_id"]: row for row in csv.DictReader(handle)}


def load_yaml_dir(directory: Path) -> dict[str, dict]:
    out = {}
    for path in sorted(directory.glob("*.yml")):
        entry = yaml.safe_load(path.read_text())
        key = entry.get("table") or entry.get("dataset_id")
        if not key:
            raise SystemExit(f"{path.name}: needs a 'table' or 'dataset_id' key")
        entry["_file"] = path.name
        out[key] = entry
    return out


def effective_licence(
    source_ids: list[str], sources: dict[str, dict], orgs: dict[str, dict]
) -> dict:
    """Resolve the licence and attribution a consumer of this table inherits."""
    licences = []
    attribution = []
    for sid in source_ids:
        if sid == "datanepal-internal":
            licences.append("cc0-1.0")
            continue
        src = sources.get(sid)
        if src is None:
            raise SystemExit(f"Unknown source '{sid}' referenced by a published table.")
        licences.append(src["licence_id"])
        # Attribution follows the PUBLISHER, never the acquisition source.
        # Crediting HDX for data UNFPA produced would be wrong, however the copy
        # reached us.
        pub = orgs.get(src["publisher_org_id"], {})
        name = pub.get("name_en") or src["publisher_org_id"]
        if name not in attribution:
            attribution.append(name)

    worst = max(licences, key=lambda lid: LICENCE_RANK.get(lid, 99))
    return {
        "effective_licence": worst,
        "share_alike": worst in ("cc-by-sa-4.0", "odbl-1.0"),
        "contributing_licences": sorted(set(licences)),
        "attribution": attribution,
    }


def export(out_dir: Path, warehouse: Path = WAREHOUSE) -> dict:
    if not warehouse.exists():
        raise SystemExit(f"No warehouse at {warehouse}. Run `dbt build` first.")

    tables = load_yaml_dir(TABLES_DIR)
    sources = load_yaml_dir(SOURCES_DIR)
    orgs = load_organisations()

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    con = duckdb.connect(str(warehouse), read_only=True)
    marts = [
        row[0]
        for row in con.execute(
            """
            select table_name from information_schema.tables
            where table_schema = ? order by table_name
            """,
            [MARTS_SCHEMA],
        ).fetchall()
    ]
    if not marts:
        # Exporting nothing is almost never intended and would write an empty
        # manifest that reads like a successful publish.
        raise SystemExit(f"No tables in schema '{MARTS_SCHEMA}'. Run `dbt build` first.")

    entries = []
    for table in marts:
        meta = tables.get(table)
        if meta is None:
            raise SystemExit(
                f"marts.{table} has no catalog entry. Add catalog/tables/{table}.yml "
                "declaring its title, description, and sources."
            )

        parquet_path = out_dir / f"{table}.parquet"
        con.execute(
            # Snappy, not zstd. Zstd compresses better, but several Parquet
            # readers -- including hyparquet, which this project's own build
            # uses -- need a plugin for it. For published data, being readable
            # everywhere beats being 20% smaller.
            f"copy (select * from {MARTS_SCHEMA}.{table}) "
            f"to '{parquet_path}' (format parquet, compression snappy)"
        )
        rows = con.execute(f"select count(*) from {MARTS_SCHEMA}.{table}").fetchone()[0]

        json_path = None
        if rows <= JSON_ROW_LIMIT:
            json_path = out_dir / f"{table}.json"
            con.execute(
                f"copy (select * from {MARTS_SCHEMA}.{table}) "
                f"to '{json_path}' (format json, array true)"
            )

        lic = effective_licence(meta.get("sources", []), sources, orgs)
        entries.append(
            {
                "table": table,
                "title": meta.get("title", table),
                "title_ne": meta.get("title_ne"),
                "description": (meta.get("description") or "").strip() or None,
                "grain": meta.get("grain"),
                "geography_level": meta.get("geography_level"),
                "sources": meta.get("sources", []),
                **lic,
                "caveats": meta.get("caveats", []),
                "row_count": rows,
                "parquet": parquet_path.name,
                "json": json_path.name if json_path else None,
                "bytes": parquet_path.stat().st_size,
            }
        )
        logger.info("Exported %-24s %7s rows  %-14s", table, f"{rows:,}", lic["effective_licence"])

    # Revision history, when it exists. Published so a consumer can answer
    # "what did this say before, and when did it change?" -- which is the
    # difference between a dataset and a snapshot.
    history_entry = None
    if HISTORY.exists():
        shutil.copy(HISTORY, out_dir / "observation_history.parquet")
        hist_rows = con.execute(
            f"select count(*) from '{HISTORY}'"
        ).fetchone()[0]
        history_entry = {
            "table": "observation_history",
            "title": "Observation revision history",
            "description": (
                "Append-only history of every published observation. One row per "
                "revision; is_current marks the present value. A superseded row "
                "keeps its original value and records when it was replaced."
            ),
            "row_count": hist_rows,
            "parquet": "observation_history.parquet",
            "bytes": (out_dir / "observation_history.parquet").stat().st_size,
        }
        logger.info(
            "Exported %-24s %7s rows  (revision history)",
            "observation_history",
            f"{hist_rows:,}",
        )

    con.close()

    def org_name(org_id: str) -> str:
        return orgs.get(org_id, {}).get("name_en") or org_id

    source_entries = []
    for s in sources.values():
        pub_id = s["publisher_org_id"]
        acq_id = s["acquired_from_org_id"]
        source_entries.append(
            {
                "dataset_id": s["dataset_id"],
                "title": s["title"],
                # Who produced it
                "publisher": org_name(pub_id),
                "publisher_org_id": pub_id,
                "publisher_name_ne": orgs.get(pub_id, {}).get("name_ne") or None,
                "publisher_homepage": orgs.get(pub_id, {}).get("homepage") or None,
                "source_tier": s.get("source_tier"),
                # Where this copy came from
                "acquired_from": org_name(acq_id),
                "acquired_from_org_id": acq_id,
                "acquisition_method": s.get("acquisition_method"),
                "acquisition_url": s.get("acquisition_url"),
                "acquired_indirectly": pub_id != acq_id,
                "url": s["url"],
                "licence": s["licence_id"],
                "licence_statement_url": s.get("licence_statement_url"),
                "commercial_reuse": s.get("commercial_reuse"),
                "rights_review_status": s.get("rights_review_status"),
                "retrieved": str(s["retrieved"]),
                "vintage": str(s["vintage"]),
                "time_coverage": s.get("time_coverage"),
                "geographic_granularity": s.get("geographic_granularity"),
                "methodology_url": s.get("methodology_url"),
                "update_frequency": s.get("update_frequency"),
                "revises_published_values": bool(s.get("revises_published_values", False)),
                "caveats": s.get("caveats", []),
            }
        )

    manifest = {
        "generated_at": datetime.now(UTC).isoformat(),
        "table_count": len(entries),
        "tables": entries,
        "history": history_entry,
        "sources": source_entries,
        "notes": {
            "licensing": (
                "Each table's effective_licence is computed from the sources it "
                "draws on, taking the most restrictive. DataNepal does not "
                "relicense upstream data; attribution requirements travel with it."
            ),
            "provenance": (
                "Every source records both who published the data and where "
                "DataNepal obtained this copy. Attribute the publisher, not the "
                "platform the copy came from."
            ),
            "additivity": (
                "Check the indicators table before aggregating. Rates, ratios, "
                "and per-capita measures are marked is_additive = false."
            ),
        },
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False)
    )
    logger.info("Wrote manifest: %d tables, %d sources", len(entries), len(source_entries))
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Export published tables")
    parser.add_argument("--out", default=str(ROOT / "publish" / "dist"))
    args = parser.parse_args()
    export(Path(args.out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
