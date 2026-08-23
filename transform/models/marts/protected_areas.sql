{{ config(materialized = 'table') }}

/*
  Nepal's national parks, wildlife reserves, and conservation areas as mapped
  by the OCHA COD (P-code type digit 5).

  Kept out of the geography spine deliberately: these are federally
  administered and sit outside local-unit jurisdiction, so counting them as
  palikas would inflate every per-unit denominator. Several span multiple
  districts, which is why a park can appear more than once here -- one row per
  (area, district) intersection.
*/

select
    pcode                as area_pcode,
    name_en              as area_name_en,
    district_pcode,
    province_pcode,
    area_sqkm,
    center_lat,
    center_lon
from {{ ref('stg_hdx__admin_units') }}
where is_protected_area
order by pcode
