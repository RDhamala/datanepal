{{ config(materialized = 'view') }}

/*
  Census 2021 literacy of the population aged 5 and over.

  The five status columns are exhaustive and disjoint, so they sum to
  population_5plus. That is asserted downstream rather than assumed: a source
  that quietly adds a sixth category would otherwise make every rate wrong while
  every row count stayed right.
*/

select
    row_id,
    level,
    trim(province_name)                    as province_name,
    trim(district_name)                    as district_name,
    trim(raw_name)                         as raw_name,
    trim(base_name)                        as base_name,
    unit_type,
    sex,
    cast(population_5plus as integer)      as population_5plus,
    cast(can_read_and_write as integer)    as can_read_and_write,
    cast(can_read_only as integer)         as can_read_only,
    cast(cannot_read_or_write as integer)  as cannot_read_or_write,
    cast(literacy_not_stated as integer)   as literacy_not_stated
from {{ source('raw_nso_census', 'census_literacy') }}
where population_5plus is not null
  and sex is not null
