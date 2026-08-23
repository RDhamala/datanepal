{{ config(materialized = 'table') }}

/*
  Protected areas: national parks, reserves, conservation areas.

  Kept out of the administrative hierarchy because they are federally
  administered and sit outside local-unit jurisdiction. Several span districts,
  so one appears once per district it intersects.
*/

select
    place_id,
    ocha_pcode          as area_pcode,
    name_en             as area_name_en,
    parent_place_id     as district_place_id,
    parent_name_en      as district_name_en,
    area_sqkm,
    center_lat,
    center_lon
from {{ ref('places') }}
where place_type = 'protected_area'
order by ocha_pcode
