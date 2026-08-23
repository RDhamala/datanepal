{{ config(materialized = 'view') }}

/*
  Administrative units from the OCHA COD, one row per unit across admin
  levels 1-3, with the P-code hierarchy made explicit.

  P-codes are positional: NP | province(2) | district(2) | type(1) | seq(2).
  Because a child's code is prefixed by its parent's, the province and district
  keys are substrings rather than lookups -- no crosswalk needed within this
  source. Crosswalks are only required to reach *other* sources.
*/

with source as (
    select * from {{ source('raw_hdx_admin', 'admin_units') }}
)

select
    pcode,
    admin_level,
    trim(name_en)                                    as name_en,
    unit_type,
    parent_pcode,

    -- Derive ancestry from the code itself. Valid at every level: a province
    -- is its own province_pcode, and its district_pcode is null.
    substr(pcode, 1, 4)                              as province_pcode,
    case when admin_level >= 2 then substr(pcode, 1, 6) end as district_pcode,

    cast(area_sqkm   as double)                      as area_sqkm,
    cast(center_lat  as double)                      as center_lat,
    cast(center_lon  as double)                      as center_lon,

    -- Protected areas (national parks, reserves) are federally administered
    -- and sit outside palika jurisdiction. Excluding them is the difference
    -- between 753 local units and 775 admin3 rows.
    unit_type = 'protected_area'                     as is_protected_area

from source
where pcode is not null
