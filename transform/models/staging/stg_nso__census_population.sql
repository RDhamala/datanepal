{{ config(materialized = 'view') }}

/*
  Census 2021 households and population, as ingested.

  Rename and type only. The hierarchy was already resolved at ingestion, where
  the sequence code and letter case are available; reconstructing it in SQL from
  row order would be fragile and unnecessary.
*/

select
    row_id,
    level,
    trim(province_name)                as province_name,
    trim(district_name)                as district_name,
    trim(raw_name)                     as raw_name,
    trim(base_name)                    as base_name,
    unit_type,
    cast(households as integer)        as households,
    cast(population_total as integer)  as population_total,
    cast(population_male as integer)   as population_male,
    cast(population_female as integer) as population_female
from {{ source('raw_nso_census', 'census_population') }}
where population_total is not null
