{{ config(materialized = 'table') }}

/*
  Convenience view: the 753 local units with district and province lineage
  denormalised onto each row.

  Derived from places, which is canonical. This exists because walking the
  parent chain is a real cost for consumers who just want a flat file, not
  because the hierarchy should be stored twice.
*/

with lu as (
    select * from {{ ref('places') }} where admin_level = 3
),
d as (select place_id, name_en, ocha_pcode from {{ ref('places') }} where admin_level = 2),
p as (select place_id, name_en, name_ne, ocha_pcode from {{ ref('places') }} where admin_level = 1)

select
    lu.place_id,
    lu.ocha_pcode           as palika_pcode,
    lu.name_en              as palika_name_en,
    lu.name_ne              as palika_name_ne,
    lu.place_type           as palika_type,
    d.place_id              as district_place_id,
    d.ocha_pcode            as district_pcode,
    d.name_en               as district_name_en,
    p.place_id              as province_place_id,
    p.ocha_pcode            as province_pcode,
    p.name_en               as province_name_en,
    p.name_ne               as province_name_ne,
    lu.area_sqkm,
    lu.center_lat,
    lu.center_lon
from lu
join d on lu.parent_place_id = d.place_id
join p on d.place_id is not null and p.place_id = (
    select parent_place_id from {{ ref('places') }} where place_id = d.place_id
)
order by lu.ocha_pcode
