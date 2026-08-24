{{ config(severity = 'error', error_if = '>0') }}

/*
  The literacy statuses must sum to the 5-plus population they partition.

  This is the guard that makes a composition chart safe to draw. A 100% stacked
  bar silently renormalises whatever it is given: if a category were missing, the
  bar would still fill the width and every proportion in it would be wrong, with
  nothing on screen to say so. Checking the parts against the published whole is
  the only place that error is visible.

  Zero tolerance, because these are counts from one table rather than
  independently produced figures.
*/

with parts as (
    select
        o.place_id,
        d.member_id as sex,
        sum(o.value_numeric) as status_total
    from {{ ref('observations') }} o
    join {{ ref('observation_dimensions') }} d
        on d.observation_id = o.observation_id and d.dimension_id = 'sex'
    join {{ ref('observation_dimensions') }} ls
        on ls.observation_id = o.observation_id and ls.dimension_id = 'literacy_status'
    where o.indicator_id = 'population_5plus'
    group by o.place_id, d.member_id
),

whole as (
    select o.place_id, o.dimension_key, o.value_numeric as total
    from {{ ref('observations') }} o
    where o.indicator_id = 'population_5plus'
      and o.dimension_key in ('sex=all', 'sex=male', 'sex=female')
)

select
    p.place_id,
    p.sex,
    p.status_total,
    w.total,
    p.status_total - w.total as difference
from parts p
join whole w
    on w.place_id = p.place_id and w.dimension_key = 'sex=' || p.sex
where p.status_total <> w.total
