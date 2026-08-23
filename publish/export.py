"""Export published marts to static files for CDN hosting.

The serving model is deliberately boring: every mart becomes a Parquet file and
a JSON file on a CDN. The browser queries the Parquet directly via DuckDB-WASM.

There is no API server, which means nothing to operate, nothing to OOM, no
database exposed to the internet, and no per-request cost. Nepal's aggregate
data is tens of megabytes -- small enough that shipping the whole dataset to
the client beats querying it remotely.

    python -m publish.export --out publish/dist
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
WAREHOUSE = ROOT / "warehouse" / "datanepal.duckdb"
CATALOG_DIR = ROOT / "catalog" / "datasets"

# dbt-duckdb prefixes custom schemas with the profile's default schema, so the
# `marts` config in dbt_project.yml materialises as `main_marts`.
MARTS_SCHEMA = "main_marts"

# JSON is emitted alongside Parquet for tables small enough that a client
# shouldn't need DuckDB-WASM just to read them.
JSON_ROW_LIMIT = 5_000


def load_catalog() -> list[dict]:
    """Read dataset metadata. Every published table must have a catalog entry.

    Provenance is not optional here: an aggregate with no stated source,
    licence, or collection date is not citable, and citability is most of what
    makes a public data platform worth using.
    """
    entries = []
    for path in sorted(CATALOG_DIR.glob("*.yml")):
        with path.open() as handle:
            entry = yaml.safe_load(handle)
        entry["_catalog_file"] = path.name
        entries.append(entry)
    return entries


def export(out_dir: Path, warehouse: Path = WAREHOUSE) -> dict:
    if not warehouse.exists():
        raise SystemExit(
            f"No warehouse at {warehouse}. Run ingestion and `dbt build` first."
        )

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    con = duckdb.connect(str(warehouse), read_only=True)
    catalog = load_catalog()
    by_table = {entry["table"]: entry for entry in catalog}

    marts = [
        row[0]
        for row in con.execute(
            """
            select table_name
            from information_schema.tables
            where table_schema = ?
            order by table_name
            """,
            [MARTS_SCHEMA],
        ).fetchall()
    ]

    if not marts:
        # Exporting nothing is almost never what anyone wants; it usually means
        # dbt has not run or the schema name changed. Fail rather than write an
        # empty manifest that looks like a successful publish.
        raise SystemExit(
            f"No tables found in schema '{MARTS_SCHEMA}'. Run `dbt build` first."
        )

    manifest_datasets = []
    for table in marts:
        entry = by_table.get(table)
        if entry is None:
            # Fail rather than silently publishing undocumented data.
            raise SystemExit(
                f"Table marts.{table} has no catalog entry. "
                f"Add catalog/datasets/{table}.yml describing its source and licence."
            )

        parquet_path = out_dir / f"{table}.parquet"
        con.execute(
            f"copy (select * from {MARTS_SCHEMA}.{table}) to '{parquet_path}' (format parquet)"
        )

        row_count = con.execute(f"select count(*) from {MARTS_SCHEMA}.{table}").fetchone()[0]

        json_path = None
        if row_count <= JSON_ROW_LIMIT:
            json_path = out_dir / f"{table}.json"
            con.execute(
                f"copy (select * from {MARTS_SCHEMA}.{table}) "
                f"to '{json_path}' (format json, array true)"
            )

        logger.info("Exported %s (%s rows)", table, f"{row_count:,}")
        manifest_datasets.append(
            {
                "table": table,
                "title": entry.get("title", table),
                "description": entry.get("description"),
                "source": entry.get("source"),
                "licence": entry.get("licence"),
                "vintage": entry.get("vintage"),
                "row_count": row_count,
                "parquet": parquet_path.name,
                "json": json_path.name if json_path else None,
                "bytes": parquet_path.stat().st_size,
            }
        )

    con.close()

    manifest = {
        "generated_at": datetime.now(UTC).isoformat(),
        "dataset_count": len(manifest_datasets),
        "datasets": manifest_datasets,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    logger.info("Wrote manifest with %d datasets to %s", len(manifest_datasets), out_dir)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Export marts to static files")
    parser.add_argument("--out", default=str(ROOT / "publish" / "dist"), help="Output directory")
    args = parser.parse_args()
    export(Path(args.out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
