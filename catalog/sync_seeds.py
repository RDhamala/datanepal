"""Generate dbt seeds from the catalog.

The catalog YAML is the human-authored source of truth for provenance. dbt
cannot read YAML at run time, so this projects it into CSV seeds that models
can join against. Running it is part of the build, not something to remember.

Keeping one source of truth matters here: a `datasets` seed maintained by hand
alongside catalog YAML would drift, and provenance that drifts is worse than
provenance that is absent, because it looks authoritative.

    python -m catalog.sync_seeds
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SOURCES_DIR = ROOT / "catalog" / "sources"
TABLES_DIR = ROOT / "catalog" / "tables"
SEEDS_DIR = ROOT / "transform" / "seeds"

DATASET_COLUMNS = [
    "dataset_id",
    "title",
    "publisher",
    "url",
    "artifact_url",
    "licence_id",
    "licence_statement_url",
    "retrieved",
    "vintage",
    "methodology_url",
    "update_frequency",
    "revises_published_values",
]

TABLE_SOURCE_COLUMNS = ["table_name", "dataset_id"]

# Reference tables carry no upstream data. They still need a dataset row so
# every observation and place can point at one, and so licence computation has
# something to resolve.
INTERNAL_DATASET = {
    "dataset_id": "datanepal-internal",
    "title": "DataNepal internal reference data",
    "publisher": "DataNepal",
    "url": "https://github.com/RDhamala/datanepal",
    "artifact_url": "",
    "licence_id": "cc0-1.0",
    "licence_statement_url": "",
    "retrieved": "",
    "vintage": "",
    "methodology_url": "",
    "update_frequency": "irregular",
    "revises_published_values": "false",
}


def load_yaml_dir(directory: Path) -> list[dict]:
    out = []
    for path in sorted(directory.glob("*.yml")):
        entry = yaml.safe_load(path.read_text())
        if not isinstance(entry, dict):
            raise SystemExit(f"{path.name}: expected a mapping")
        entry["_file"] = path.name
        out.append(entry)
    return out


def write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({c: row.get(c, "") for c in columns})


def main() -> int:
    sources = load_yaml_dir(SOURCES_DIR)
    tables = load_yaml_dir(TABLES_DIR)

    dataset_rows = [INTERNAL_DATASET]
    for s in sources:
        row = {c: s.get(c, "") for c in DATASET_COLUMNS}
        # CSV has no booleans; normalise so DuckDB reads them consistently.
        row["revises_published_values"] = str(
            bool(s.get("revises_published_values", False))
        ).lower()
        dataset_rows.append(row)

    known = {r["dataset_id"] for r in dataset_rows}
    link_rows = []
    problems = []
    for t in tables:
        for dataset_id in t.get("sources", []):
            if dataset_id not in known:
                problems.append(
                    f"{t['_file']}: source '{dataset_id}' has no entry in catalog/sources/"
                )
            link_rows.append({"table_name": t["table"], "dataset_id": dataset_id})

    if problems:
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        raise SystemExit("Catalog references unknown sources.")

    SEEDS_DIR.mkdir(parents=True, exist_ok=True)
    write_csv(SEEDS_DIR / "datasets.csv", DATASET_COLUMNS, dataset_rows)
    write_csv(SEEDS_DIR / "table_sources.csv", TABLE_SOURCE_COLUMNS, link_rows)

    print(
        f"Wrote {len(dataset_rows)} datasets and {len(link_rows)} table-source links."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
