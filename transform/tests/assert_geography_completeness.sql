{{
  config(
    severity = 'error',
    error_if = '>0',
  )
}}

/*
  Assert the geography spine is complete: every province should contribute the
  number of districts and local units the federal structure defines.

  This matters more than it looks. If a source load drops half of Karnali, no
  join fails and no row count looks obviously wrong -- every downstream
  aggregate simply under-reports, quietly, and a published statistic is wrong
  in a way nobody notices. Counting against a known-good expectation is the
  only cheap way to catch it.

  Severity is `error`: the spine now loads from the OCHA COD, which carries all
  753 units, so any shortfall means a broken or truncated load and should stop
  the build rather than emit a warning nobody reads.
*/

with actual as (
    select
        province_id,
        count(*)                    as actual_palikas,
        count(distinct district_pcode) as actual_districts
    from {{ ref('int_geography') }}
    group by province_id
),

expected as (
    select
        province_id,
        province_name_en,
        expected_palikas,
        expected_districts
    from {{ ref('np_provinces') }}
)

select
    e.province_id,
    e.province_name_en,
    e.expected_districts,
    coalesce(a.actual_districts, 0) as actual_districts,
    e.expected_palikas,
    coalesce(a.actual_palikas, 0)   as actual_palikas
from expected e
left join actual a
    on e.province_id = a.province_id
where coalesce(a.actual_palikas, 0)   <> e.expected_palikas
   or coalesce(a.actual_districts, 0) <> e.expected_districts
