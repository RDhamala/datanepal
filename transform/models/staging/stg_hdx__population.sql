{{ config(materialized = 'view') }}

/*
  Population counts from COD-PS, already unpivoted to long form during
  ingestion. Staging only types and validates.
*/

with source as (
    select * from {{ source('raw_hdx_population', 'population') }}
)

select
    trim(place_pcode)          as place_pcode,
    cast(admin_level as integer) as admin_level,
    cast(year as integer)      as year,
    sex,
    age_band,
    cast(population as bigint) as population
from source
where place_pcode is not null
  and population is not null
  -- Negative counts would indicate a corrupt source file, not a real value.
  and cast(population as bigint) >= 0
