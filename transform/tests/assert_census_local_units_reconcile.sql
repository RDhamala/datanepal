{{ config(severity = 'error', error_if = '>0') }}

/*
  Within every district, household population across its local units plus that
  district's institutional population must equal the district total.

  This is the check that gives the residence_type dimension its point. Local
  units report household population only; institutional population -- barracks,
  hostels, prisons, hospitals -- is reported per district and belongs to no local
  unit. Nationally that is 239,098 people.

  Without the dimension, districts would simply not equal the sum of their local
  units and there would be no way to tell an accounting difference from a partial
  load. With it, the two are the same arithmetic and this test distinguishes them.

  Scoped to sex = 'all' because the components are the same rows either way and
  three copies of the same assertion is noise.
*/

with local_household as (
    select
        d.place_id            as district_id,
        sum(o.value_numeric)  as local_total
    from {{ ref('observations') }} o
    join {{ ref('places') }} p on p.place_id = o.place_id
    join {{ ref('places') }} d on d.place_id = p.parent_place_id
    where o.dataset_id = 'nso-nphc-2021'
      and o.indicator_id = 'population'
      and o.dimension_key = 'residence_type=household|sex=all'
      and p.place_type in ('metropolitan', 'sub_metropolitan',
                           'municipality', 'rural_municipality')
    group by d.place_id
),

institutional as (
    select o.place_id as district_id, sum(o.value_numeric) as inst_total
    from {{ ref('observations') }} o
    where o.dataset_id = 'nso-nphc-2021'
      and o.indicator_id = 'population'
      and o.dimension_key = 'residence_type=institutional|sex=all'
    group by o.place_id
),

district_total as (
    select o.place_id as district_id, o.value_numeric as district_value
    from {{ ref('observations') }} o
    join {{ ref('places') }} p on p.place_id = o.place_id
    where o.dataset_id = 'nso-nphc-2021'
      and o.indicator_id = 'population'
      and o.dimension_key = 'residence_type=all|sex=all'
      and p.place_type = 'district'
)

select
    t.district_id,
    t.district_value,
    coalesce(l.local_total, 0) as local_household_total,
    coalesce(i.inst_total, 0)  as institutional_total,
    t.district_value - (coalesce(l.local_total, 0) + coalesce(i.inst_total, 0)) as difference
from district_total t
left join local_household l on l.district_id = t.district_id
left join institutional i on i.district_id = t.district_id
where t.district_value <> coalesce(l.local_total, 0) + coalesce(i.inst_total, 0)
