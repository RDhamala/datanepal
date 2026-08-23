"""Load a small synthetic raw dataset for local development and CI.

A full ingest means ~800 requests to a government server and takes the better
part of an hour, which is not something CI should do on every push. This writes
a handful of representative rows into the same raw tables the real loaders
target, so `dbt build` and the export step are exercised end to end.

The rows deliberately include all four local-unit types, including the
substring-nesting trap between उपमहानगरपालिका, महानगरपालिका, and नगरपालिका,
so the classification logic in staging is actually tested.

    python -m ingestion.fixtures
"""

from __future__ import annotations

import logging
from pathlib import Path

import duckdb

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

WAREHOUSE = Path(__file__).resolve().parent.parent / "warehouse" / "datanepal.duckdb"

# (province_id, district_id, district_name, palika_id, palika_name)
ROWS = [
    (3, 27, "काठमाडौँ", 27001, "काठमाडौँ महानगरपालिका"),
    (3, 27, "काठमाडौँ", 27002, "कागेश्वरी मनोहरा नगरपालिका"),
    (3, 27, "काठमाडौँ", 27003, "गोकर्णेश्वर नगरपालिका"),
    (3, 25, "ललितपुर", 25001, "ललितपुर महानगरपालिका"),
    (3, 25, "ललितपुर", 25002, "कोन्ज्योसोम गाउँपालिका"),
    (3, 26, "भक्तपुर", 26001, "भक्तपुर नगरपालिका"),
    # Sub-metropolitan: contains महानगरपालिका as a substring. If staging tests
    # the shorter label first, this row is misclassified as metropolitan.
    (2, 8, "बारा", 8001, "जितपुरसिमरा उपमहानगरपालिका"),
    (2, 8, "बारा", 8002, "कलैया उपमहानगरपालिका"),
    (4, 36, "कास्की", 36001, "पोखरा महानगरपालिका"),
    (4, 36, "कास्की", 36002, "अन्नपूर्ण गाउँपालिका"),
    (1, 12, "मोरङ", 12001, "विराटनगर महानगरपालिका"),
    (5, 51, "रूपन्देही", 51001, "बुटवल उपमहानगरपालिका"),
    (6, 61, "सुर्खेत", 61001, "वीरेन्द्रनगर नगरपालिका"),
    (7, 71, "कैलाली", 71001, "धनगढी उपमहानगरपालिका"),
    # Leading/trailing whitespace and a non-breaking space, as the real source
    # emits. Staging must normalise these or joins silently miss.
    (7, 71, "कैलाली", 71002, "  गोदावरी नगरपालिका  "),
]


def load(warehouse: Path = WAREHOUSE) -> int:
    warehouse.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(warehouse))
    try:
        con.execute("create schema if not exists raw_election_commission")
        con.execute("drop table if exists raw_election_commission.geography")
        con.execute(
            """
            create table raw_election_commission.geography (
                province_id   integer,
                district_id   integer,
                district_name varchar,
                palika_id     integer,
                palika_name   varchar
            )
            """
        )
        con.executemany(
            "insert into raw_election_commission.geography values (?, ?, ?, ?, ?)", ROWS
        )
        count = con.execute(
            "select count(*) from raw_election_commission.geography"
        ).fetchone()[0]
    finally:
        con.close()

    logger.info("Loaded %d fixture rows into %s", count, warehouse)
    return count


if __name__ == "__main__":
    load()
