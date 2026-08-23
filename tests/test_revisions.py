"""Tests for the revision-history fold.

These operate on a *copy* of the warehouse so a value can be mutated to
simulate a publisher restating a figure. Testing this any other way would mean
waiting for the World Bank to revise something.

The properties that matter:

  idempotence   re-running an unchanged build must not create revisions, or
                history fills with noise and stops being readable
  detection     a changed value must create revision 2 and retire revision 1
  preservation  the superseded value must remain readable afterwards
  single truth  exactly one current revision per observation, always
"""

from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

import duckdb
import pytest

from publish import revisions

ROOT = Path(__file__).resolve().parent.parent
WAREHOUSE = ROOT / "warehouse" / "datanepal.duckdb"

pytestmark = pytest.mark.skipif(
    not WAREHOUSE.exists(),
    reason="No warehouse; run ingestion and `dbt build` first.",
)


@pytest.fixture
def sandbox(tmp_path: Path) -> tuple[Path, Path]:
    """A private copy of the warehouse plus a fresh history path."""
    wh = tmp_path / "datanepal.duckdb"
    shutil.copy(WAREHOUSE, wh)
    return wh, tmp_path / "history.parquet"


def read_history(path: Path) -> list[dict]:
    con = duckdb.connect()
    rows = con.execute(f"select * from '{path}'").fetchall()
    cols = [d[0] for d in con.description]
    con.close()
    return [dict(zip(cols, r, strict=True)) for r in rows]


def test_first_load_creates_revision_one(sandbox):
    wh, hist = sandbox
    summary = revisions.update(date(2026, 8, 23), warehouse=wh, history=hist)

    assert summary["new_observations"] > 4000
    assert summary["revised_observations"] == 0
    assert summary["rows_beyond_first_revision"] == 0

    rows = read_history(hist)
    assert all(r["revision"] == 1 for r in rows)
    assert all(r["is_current"] for r in rows)
    assert all(r["superseded_at"] is None for r in rows)


def test_rerunning_unchanged_is_idempotent(sandbox):
    wh, hist = sandbox
    revisions.update(date(2026, 8, 23), warehouse=wh, history=hist)
    before = read_history(hist)

    # Same build, later date. Nothing changed upstream, so nothing should move.
    summary = revisions.update(date(2026, 9, 1), warehouse=wh, history=hist)
    after = read_history(hist)

    assert summary["new_observations"] == 0
    assert summary["revised_observations"] == 0
    assert len(after) == len(before)


def test_changed_value_creates_a_revision_and_keeps_the_old_one(sandbox):
    wh, hist = sandbox
    revisions.update(date(2026, 8, 23), warehouse=wh, history=hist)

    # Simulate the publisher restating one figure.
    con = duckdb.connect(str(wh))
    target = con.execute(
        """
        select observation_id, value_numeric
        from main_marts.observations
        where indicator_id = 'cpi_inflation_annual'
        order by period_start desc limit 1
        """
    ).fetchone()
    observation_id, original = target
    revised_value = original + 0.5
    con.execute(
        "update main_marts.observations set value_numeric = ? where observation_id = ?",
        [revised_value, observation_id],
    )
    con.close()

    summary = revisions.update(date(2026, 9, 1), warehouse=wh, history=hist)
    assert summary["revised_observations"] == 1
    assert summary["new_observations"] == 0

    rows = [r for r in read_history(hist) if r["observation_id"] == observation_id]
    assert len(rows) == 2, "expected the old revision to be kept alongside the new"

    old = next(r for r in rows if r["revision"] == 1)
    new = next(r for r in rows if r["revision"] == 2)

    # The prior value survives -- that is the entire point.
    assert old["value_numeric"] == pytest.approx(original)
    assert old["is_current"] is False
    assert old["superseded_at"] == date(2026, 9, 1)

    assert new["value_numeric"] == pytest.approx(revised_value)
    assert new["is_current"] is True
    assert new["superseded_at"] is None
    assert new["first_seen_at"] == date(2026, 9, 1)


def test_exactly_one_current_revision_per_observation(sandbox):
    wh, hist = sandbox
    revisions.update(date(2026, 8, 23), warehouse=wh, history=hist)

    con = duckdb.connect(str(wh))
    con.execute(
        """
        update main_marts.observations
        set value_numeric = value_numeric * 1.01
        where indicator_id = 'gdp_per_capita_usd'
        """
    )
    con.close()

    revisions.update(date(2026, 9, 1), warehouse=wh, history=hist)

    con = duckdb.connect()
    offenders = con.execute(
        f"""
        select observation_id, count(*) n
        from '{hist}' where is_current
        group by 1 having count(*) <> 1
        """
    ).fetchall()
    con.close()
    assert offenders == []


def test_status_change_alone_counts_as_a_revision(sandbox):
    """A projection becoming an actual is a revision even at the same value."""
    wh, hist = sandbox
    revisions.update(date(2026, 8, 23), warehouse=wh, history=hist)

    con = duckdb.connect(str(wh))
    observation_id = con.execute(
        """
        select observation_id from main_marts.observations
        where status = 'projection' limit 1
        """
    ).fetchone()[0]
    con.execute(
        "update main_marts.observations set status = 'actual' where observation_id = ?",
        [observation_id],
    )
    con.close()

    summary = revisions.update(date(2026, 9, 1), warehouse=wh, history=hist)
    assert summary["revised_observations"] == 1

    rows = [r for r in read_history(hist) if r["observation_id"] == observation_id]
    assert {r["revision"] for r in rows} == {1, 2}
    assert next(r for r in rows if r["revision"] == 2)["status"] == "actual"
