"""Pipeline entrypoint. Run one source, or all of them.

    python -m ingestion.run --source election_commission
    python -m ingestion.run --all

Each source loads into its own `raw_<name>` schema in the DuckDB warehouse.
dbt reads those as sources; nothing downstream touches the loaders directly.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import dlt

from ingestion.sources.election_commission import election_commission_source
from ingestion.sources.hdx_admin import hdx_admin_source
from ingestion.sources.hdx_population import hdx_population_source
from ingestion.sources.wikidata_names import wikidata_names_source

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

WAREHOUSE = Path(__file__).resolve().parent.parent / "warehouse" / "datanepal.duckdb"

# Adding a source means adding one entry here and one module in sources/.
SOURCES = {
    "hdx_admin": hdx_admin_source,
    "hdx_population": hdx_population_source,
    "wikidata_names": wikidata_names_source,
    "election_commission": election_commission_source,
}


def run_source(name: str) -> None:
    if name not in SOURCES:
        raise SystemExit(f"Unknown source '{name}'. Available: {', '.join(sorted(SOURCES))}")

    WAREHOUSE.parent.mkdir(parents=True, exist_ok=True)

    pipeline = dlt.pipeline(
        pipeline_name=f"datanepal_{name}",
        destination=dlt.destinations.duckdb(str(WAREHOUSE)),
        dataset_name=f"raw_{name}",
        progress="log",
    )

    logger.info("Loading source '%s' into %s", name, WAREHOUSE)
    info = pipeline.run(SOURCES[name]())
    logger.info("%s", info)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run datanepal ingestion")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--source", help="Name of a single source to run")
    group.add_argument("--all", action="store_true", help="Run every registered source")
    parser.add_argument(
        "--list", action="store_true", help="List registered sources and exit"
    )
    args = parser.parse_args()

    if args.list:
        for name in sorted(SOURCES):
            print(name)
        return 0

    targets = sorted(SOURCES) if args.all else [args.source]
    for name in targets:
        run_source(name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
