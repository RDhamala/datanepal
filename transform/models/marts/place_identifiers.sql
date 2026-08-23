{{ config(materialized = 'table') }}

/*
  Published crosswalk from external identifiers to canonical place_ids.

  This table is why a new source does not require name matching: register its
  codes here once and every dataset keyed on them joins cleanly.
*/

select
    place_id,
    id_system,
    id_value,
    is_authoritative,
    valid_from,
    valid_to,
    dataset_id
from {{ ref('int_place_identifiers') }}
order by id_system, id_value
