{{ config(materialized = 'view') }}

/*
  World Bank annual indicators for Nepal, national level.

  Already long-format from the API, so staging only types and validates.
*/

with source as (
    select * from {{ source('raw_worldbank', 'indicators') }}
)

select
    country_code,
    indicator_id,
    worldbank_code,
    cast(year as integer)       as year,
    cast(value as double)       as value,
    unit_id,
    status,
    -- Publication date of this vintage. Two builds seeing different values for
    -- the same year with different published_at is exactly a revision.
    cast(published_at as date)  as published_at
from source
where value is not null
