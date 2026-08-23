{{ config(materialized = 'table') }}

/*
  Published observations, current revisions only.

  Revision history is maintained outside dbt, in a committed Parquet file --
  see publish/revisions.py. The warehouse is rebuilt from scratch each run, so
  it cannot itself hold history; the history file is the persistent state, and
  git gives it an audit trail for free.
*/

select
    o.observation_id,
    o.dataset_id,
    o.indicator_id,
    o.place_id,
    o.period_start,
    o.period_end,
    o.period_type,
    o.value_numeric,
    o.value_text,
    o.unit_id,
    o.status,
    o.dimension_key
from {{ ref('int_observations') }} o
order by o.indicator_id, o.place_id, o.period_start, o.dimension_key
