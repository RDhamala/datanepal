{{ config(materialized = 'table') }}

/*
  Published observations. Every measurement the platform holds, in one shape.

  Joined to place names so a consumer can use this file alone without also
  fetching the place dimension -- the whole table is small enough that
  denormalising costs little and saves every client a join.
*/

select
    o.place_pcode,
    p.name_en        as place_name_en,
    p.name_ne        as place_name_ne,
    p.place_type,
    o.admin_level,

    o.indicator_code,
    o.period,
    o.sex,
    o.age_band,
    o.value,
    o.unit,
    o.source_id

from {{ ref('int_observations') }} o
inner join {{ ref('int_places') }} p on o.place_pcode = p.place_pcode
order by o.indicator_code, o.admin_level, o.place_pcode, o.period, o.sex, o.age_band
