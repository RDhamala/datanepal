/*
  Every place that should have geometry has it, at every admin level.

  Asserted against externally known counts rather than internal agreement: 7
  provinces, 77 districts, 753 local units, 22 protected areas. A partial
  geometry load raises no error and produces no obviously wrong row count -- it
  just silently leaves holes in a map, which reads as "no data here" rather than
  "we failed to load this".

  Protected areas are counted separately because they are not local units. That
  distinction is what makes the local-unit count 753 rather than 775, and it is
  carried by the P-code type digit, never by name.
*/

with expected as (
    select 'province'            as place_type, 7   as n
    union all select 'district',                77
    union all select 'metropolitan',            6
    union all select 'sub_metropolitan',        11
    union all select 'municipality',            276
    union all select 'rural_municipality',      460
    union all select 'protected_area',          22
),

actual as (
    select place_type, count(*) as n
    from {{ ref('place_boundaries') }}
    group by place_type
)

select
    e.place_type,
    e.n            as expected_count,
    coalesce(a.n, 0) as actual_count
from expected e
left join actual a on a.place_type = e.place_type
where coalesce(a.n, 0) != e.n
