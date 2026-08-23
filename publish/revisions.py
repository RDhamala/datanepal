"""Revision history for published observations.

Sources restate figures. The World Bank revises national accounts, UNFPA
reprojects populations, budgets move from provisional to final. A refresh that
overwrites the previous number destroys the ability to answer "what did this say
last year, and when did it change?" -- which is both a credibility requirement
and, per docs/product.md, a capability that cannot be reconstructed after the
fact. History has to be captured from the first load or it is gone.

The warehouse is rebuilt from scratch on every run, so it cannot hold history.
The persistent state is a committed Parquet file:

    history/observation_history.parquet

Committing it means git provides the audit trail for free: every value change is
a reviewable diff, attributable to a commit and a date.

Model
-----
Append-only. One row per (observation_id, revision).

  revision       1 for the first sighting, incremented when the value or status
                 changes for the same natural key
  first_seen_at  when DataNepal first published this revision
  published_at   the publisher's own vintage date, when they supply one
  superseded_at  set on the previous revision when a new one arrives
  is_current     exactly one true row per observation_id

A value that is republished unchanged does not create a revision. Only a change
in `value_numeric`, `value_text`, or `status` does -- re-running the pipeline
must be idempotent, or history fills with noise and stops being readable.
"""

from __future__ import annotations

import argparse
import logging
from datetime import UTC, date, datetime
from pathlib import Path

import duckdb

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
WAREHOUSE = ROOT / "warehouse" / "datanepal.duckdb"
HISTORY = ROOT / "history" / "observation_history.parquet"

# Columns whose change constitutes a revision. Deliberately narrow: a change in
# unit or period would be a different observation, not a revision of this one.
REVISABLE = ("value_numeric", "value_text", "status")

HISTORY_COLUMNS = [
    "observation_id",
    "revision",
    "dataset_id",
    "indicator_id",
    "place_id",
    "period_start",
    "period_end",
    "period_type",
    "value_numeric",
    "value_text",
    "unit_id",
    "status",
    "dimension_key",
    "first_seen_at",
    "published_at",
    "superseded_at",
    "is_current",
]


def _empty_history(con: duckdb.DuckDBPyConnection) -> None:
    """Create an empty history relation with the right types."""
    con.execute(
        """
        create or replace table history as
        select
            cast(null as varchar)  as observation_id,
            cast(null as integer)  as revision,
            cast(null as varchar)  as dataset_id,
            cast(null as varchar)  as indicator_id,
            cast(null as varchar)  as place_id,
            cast(null as date)     as period_start,
            cast(null as date)     as period_end,
            cast(null as varchar)  as period_type,
            cast(null as double)   as value_numeric,
            cast(null as varchar)  as value_text,
            cast(null as varchar)  as unit_id,
            cast(null as varchar)  as status,
            cast(null as varchar)  as dimension_key,
            cast(null as date)     as first_seen_at,
            cast(null as date)     as published_at,
            cast(null as date)     as superseded_at,
            cast(null as boolean)  as is_current
        where false
        """
    )


def update(as_of: date, warehouse: Path = WAREHOUSE, history: Path = HISTORY) -> dict:
    """Fold the current build into the history file. Returns a summary."""
    if not warehouse.exists():
        raise SystemExit(f"No warehouse at {warehouse}. Run `dbt build` first.")

    history.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    # Attach under the warehouse's own name. dbt-duckdb bakes the database name
    # into view definitions, so a different alias breaks every view -- which
    # fails as an obscure "Catalog does not exist" error rather than anything
    # that points at the cause.
    con.execute(f"attach '{warehouse}' as datanepal (read_only)")

    if history.exists():
        con.execute(f"create or replace table history as select * from '{history}'")
    else:
        logger.info("No history file yet; creating one.")
        _empty_history(con)

    # Publisher vintage dates, where the source supplies them. Only the World
    # Bank does today; a missing value is not an error.
    con.execute(
        """
        create or replace table pub_dates as
        select 'obs_' as prefix, cast(null as varchar) as observation_id,
               cast(null as date) as published_at where false
        """
    )
    try:
        con.execute(
            """
            insert into pub_dates
            select
                'obs_',
                o.observation_id,
                max(w.published_at)
            from datanepal.main_marts.observations o
            join datanepal.main_staging.stg_worldbank__indicators w
              on o.indicator_id = w.indicator_id
             and year(o.period_start) = w.year
            where o.dataset_id = 'worldbank-npl'
            group by o.observation_id
            """
        )
    except duckdb.Error as exc:  # pragma: no cover - source may be absent
        logger.warning("Could not resolve publisher dates: %s", exc)

    con.execute(
        """
        create or replace table current_build as
        select
            o.*,
            p.published_at
        from datanepal.main_marts.observations o
        left join pub_dates p on o.observation_id = p.observation_id
        """
    )

    current = con.execute(
        "select count(*) from history where is_current"
    ).fetchone()[0]

    # Classify: unchanged, changed, new.
    changed = con.execute(
        f"""
        select count(*)
        from current_build c
        join history h on c.observation_id = h.observation_id and h.is_current
        where {" or ".join(
            f"coalesce(cast(c.{col} as varchar), '~') "
            f"<> coalesce(cast(h.{col} as varchar), '~')" for col in REVISABLE
        )}
        """
    ).fetchone()[0]

    new = con.execute(
        """
        select count(*) from current_build c
        where not exists (
            select 1 from history h where h.observation_id = c.observation_id
        )
        """
    ).fetchone()[0]

    con.execute(
        f"""
        create or replace table next_history as

        -- Rows that keep their current status: unchanged, or already historical.
        with changed_ids as (
            select c.observation_id
            from current_build c
            join history h on c.observation_id = h.observation_id and h.is_current
            where {" or ".join(
                f"coalesce(cast(c.{col} as varchar), '~') "
                f"<> coalesce(cast(h.{col} as varchar), '~')" for col in REVISABLE
            )}
        ),

        retired as (
            -- Previous current rows whose value moved: mark superseded.
            select
                h.* replace (
                    false as is_current,
                    date '{as_of}' as superseded_at
                )
            from history h
            join changed_ids ci on h.observation_id = ci.observation_id
            where h.is_current
        ),

        untouched as (
            select h.* from history h
            where not h.is_current
               or h.observation_id not in (select observation_id from changed_ids)
        ),

        appended as (
            -- New revisions, and first sightings.
            select
                c.observation_id,
                coalesce(
                    (select max(h2.revision) from history h2
                      where h2.observation_id = c.observation_id), 0
                ) + 1                              as revision,
                c.dataset_id,
                c.indicator_id,
                c.place_id,
                c.period_start,
                c.period_end,
                c.period_type,
                c.value_numeric,
                c.value_text,
                c.unit_id,
                c.status,
                c.dimension_key,
                date '{as_of}'                     as first_seen_at,
                c.published_at,
                cast(null as date)                 as superseded_at,
                true                               as is_current
            from current_build c
            where c.observation_id in (select observation_id from changed_ids)
               or not exists (
                    select 1 from history h where h.observation_id = c.observation_id
               )
        )

        select {", ".join(HISTORY_COLUMNS)} from untouched
        union all by name
        select {", ".join(HISTORY_COLUMNS)} from retired
        union all by name
        select {", ".join(HISTORY_COLUMNS)} from appended
        """
    )

    # An observation must have exactly one current revision. If this ever fires,
    # the fold logic is wrong and history is no longer trustworthy -- fail rather
    # than write a corrupt file.
    bad = con.execute(
        """
        select observation_id, count(*) n
        from next_history where is_current
        group by 1 having count(*) <> 1
        """
    ).fetchall()
    if bad:
        raise SystemExit(
            f"{len(bad)} observations would have multiple current revisions; "
            "refusing to write history."
        )

    con.execute(
        f"copy (select * from next_history) to '{history}' (format parquet)"
    )
    total = con.execute("select count(*) from next_history").fetchone()[0]
    revisions = con.execute(
        "select count(*) from next_history where revision > 1"
    ).fetchone()[0]
    con.close()

    summary = {
        "previously_current": current,
        "new_observations": new,
        "revised_observations": changed,
        "history_rows": total,
        "rows_beyond_first_revision": revisions,
    }
    logger.info(
        "history: %d rows (%d new, %d revised, %d beyond first revision)",
        total, new, changed, revisions,
    )
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Fold the current build into history")
    parser.add_argument(
        "--as-of",
        default=datetime.now(UTC).date().isoformat(),
        help="Date to stamp new revisions with (default: today, UTC)",
    )
    args = parser.parse_args()
    update(date.fromisoformat(args.as_of))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
