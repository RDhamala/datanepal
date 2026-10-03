{{ config(severity = 'error', error_if = '>0') }}

/*
  No abolished place may reach a current-facing published table.

  This is the cost ADR-0008 accepted: `places` now holds rows most consumers do
  not want, and every downstream table has to filter. Forgetting the filter is
  not a crash -- it is an extra feature on a choropleth, a district page
  generated for a district abolished in 2015, or a row count that quietly stops
  matching the federal structure.

  Cheaper to assert once here than to notice on the rendered page, which is how
  the last geography bug of this shape was actually found.
*/

with historical as (
    select place_id, name_en from {{ ref('places') }} where not is_current
),

leaked as (
    select 'geography' as table_name, h.place_id, h.name_en
    from {{ ref('geography') }} g
    join historical h on h.place_id = g.place_id

    union all

    select 'place_boundaries', h.place_id, h.name_en
    from {{ ref('place_boundaries') }} b
    join historical h on h.place_id = b.place_id

    union all

    select 'protected_areas', h.place_id, h.name_en
    from {{ ref('protected_areas') }} a
    join historical h on h.place_id = a.place_id
)

select
    table_name,
    place_id,
    name_en,
    'historical place present in a current-facing table' as problem
from leaked
