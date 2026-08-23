{{ config(materialized = 'table') }}

/*
  The geography spine: one row per local unit (palika), with full
  province -> district -> palika lineage denormalised onto it.

  753 rows. Protected areas are excluded here and published separately; they
  are not local units, and including them would inflate every denominator.

  Every dataset on the platform joins to this table on `palika_pcode`. Sources
  that key differently (the Election Commission's integer IDs, NSO census
  codes) reach it through crosswalk tables rather than by matching names --
  see int_crosswalk_*.
*/

with local_units as (
    select *
    from {{ ref('stg_hdx__admin_units') }}
    where admin_level = 3
      and not is_protected_area
),

districts as (
    select pcode, name_en
    from {{ ref('stg_hdx__admin_units') }}
    where admin_level = 2
),

provinces_hdx as (
    select pcode, name_en
    from {{ ref('stg_hdx__admin_units') }}
    where admin_level = 1
)

select
    -- Canonical key for the whole platform.
    lu.pcode                        as palika_pcode,
    lu.name_en                      as palika_name_en,
    lu.unit_type                    as palika_type,

    lu.district_pcode,
    d.name_en                       as district_name_en,

    lu.province_pcode,
    ph.name_en                      as province_name_en,

    -- Nepali names and the official 1-7 province numbering come from the
    -- hand-verified seed; the COD publishes English only.
    p.province_id,
    p.province_name_ne,
    p.province_code                 as province_iso_code,

    lu.area_sqkm,
    lu.center_lat,
    lu.center_lon

from local_units lu
inner join districts     d  on lu.district_pcode = d.pcode
inner join provinces_hdx ph on lu.province_pcode = ph.pcode
inner join {{ ref('np_provinces') }} p
    -- The COD encodes the province number in P-code positions 3-4, which
    -- matches the official 1-7 numbering used by every Nepali source.
    on cast(substr(lu.province_pcode, 3, 2) as integer) = p.province_id
