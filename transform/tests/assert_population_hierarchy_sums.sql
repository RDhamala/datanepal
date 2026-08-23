{{ config(severity = 'error', error_if = '>0') }}

/*
  Population must reconcile across administrative levels: the sum of provinces,
  and the sum of districts, must each equal the national figure for the same
  period and dimension combination.

  This is the cheapest guard against the failure mode this platform is most
  exposed to. A partial load raises no error and produces no obviously wrong row
  count -- the national page simply under-reports, and so does every per-capita
  figure derived from it.

  It is also a genuine source check: if UNFPA's district file ever disagrees
  with its national file, we should know before republishing either.

  Scoped to population deliberately. Most indicators are not additive across
  places -- see the is_additive flag on indicators -- and applying this to
  inflation or GDP per capita would be nonsense.
*/

with pop as (
    select
        o.place_id,
        p.admin_level,
        o.period_start,
        o.dimension_key,
        o.value_numeric
    from {{ ref('observations') }} o
    join {{ ref('places') }} p on o.place_id = p.place_id
    where o.indicator_id = 'population'
),

national as (
    select period_start, dimension_key, value_numeric as national_value
    from pop
    where admin_level = 0
),

by_level as (
    select admin_level, period_start, dimension_key, sum(value_numeric) as level_total
    from pop
    where admin_level > 0
    group by admin_level, period_start, dimension_key
)

select
    b.admin_level,
    b.period_start,
    b.dimension_key,
    n.national_value,
    b.level_total,
    b.level_total - n.national_value as difference
from by_level b
join national n
    on b.period_start = n.period_start
   and b.dimension_key = n.dimension_key
where b.level_total <> n.national_value
