{{ config(materialized = 'table') }}

/*
  Unified place dimension across every admin level: 1 country + 7 provinces +
  77 districts + 753 local units = 838 places.

  int_geography is palika-only because it is the local-unit spine. Page
  generation and the observation table need every level addressable by the same
  key, so this widens it. One row per place, whatever its level.
*/

with units as (
    select * from {{ ref('stg_hdx__admin_units') }}
),

names as (
    select palika_pcode, palika_name_ne from {{ ref('int_place_names') }}
),

provinces as (
    select province_id, province_name_ne, province_code from {{ ref('np_provinces') }}
)

-- Country
select
    'NP'          as place_pcode,
    0             as admin_level,
    'country'     as place_type,
    'Nepal'       as name_en,
    'नेपाल'        as name_ne,
    cast(null as varchar) as parent_pcode,
    cast(null as double)  as area_sqkm,
    cast(null as double)  as center_lat,
    cast(null as double)  as center_lon

union all

-- Provinces: Nepali names come from the hand-verified seed.
select
    u.pcode,
    1,
    'province',
    u.name_en,
    p.province_name_ne,
    'NP',
    u.area_sqkm,
    u.center_lat,
    u.center_lon
from units u
left join provinces p
    on cast(substr(u.pcode, 3, 2) as integer) = p.province_id
where u.admin_level = 1

union all

-- Districts: no Nepali names sourced yet.
select
    u.pcode,
    2,
    'district',
    u.name_en,
    cast(null as varchar),
    u.parent_pcode,
    u.area_sqkm,
    u.center_lat,
    u.center_lon
from units u
where u.admin_level = 2

union all

-- Local units, excluding protected areas.
select
    u.pcode,
    3,
    u.unit_type,
    u.name_en,
    n.palika_name_ne,
    u.parent_pcode,
    u.area_sqkm,
    u.center_lat,
    u.center_lon
from units u
left join names n on u.pcode = n.palika_pcode
where u.admin_level = 3
  and not u.is_protected_area
