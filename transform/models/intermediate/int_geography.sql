{{
  config(
    materialized = 'table',
    unique_key = 'palika_id',
  )
}}

/*
  The geography spine: one row per local unit (palika), carrying its full
  province -> district -> palika lineage in both English and Nepali.

  Every dataset in the platform joins to this table. Nepali sources key
  geography inconsistently -- the Election Commission, the census, and the
  ministries each use their own codes and transliterations -- so conforming
  once here is what makes cross-dataset questions answerable at all.

  Provinces come from a hand-verified seed. Districts and palikas are derived
  from whichever sources have loaded, then tested against the seed's expected
  counts, so an incomplete load fails loudly instead of silently under-reporting.
*/

with source_geography as (
    -- Union every ingested source that carries geography. Each staging model
    -- exposes the same six columns so adding a source needs no change here
    -- beyond one more select.
    select province_id, district_id, district_name_ne, palika_id, palika_name_ne, palika_type
    from {{ ref('stg_election_commission__geography') }}

    -- As further sources land, union them in with the same column list, e.g.
    --   union all
    --   select province_id, district_id, ... from (ref the census staging model)
    -- Note: dbt renders Jinja inside SQL comments too, so do not write a
    -- literal ref() call here for a model that does not exist yet.
),

deduplicated as (
    -- Sources disagree on spelling and whitespace. Take the most common
    -- rendering of each name rather than an arbitrary one.
    select
        palika_id,
        any_value(province_id)   as province_id,
        any_value(district_id)   as district_id,
        mode(district_name_ne)   as district_name_ne,
        mode(palika_name_ne)     as palika_name_ne,
        mode(palika_type)        as palika_type
    from source_geography
    where palika_id is not null
    group by palika_id
)

select
    d.palika_id,
    d.district_id,
    d.province_id,

    p.province_code,
    p.province_name_en,
    p.province_name_ne,

    d.district_name_ne,
    d.palika_name_ne,

    -- Metropolitan / sub-metropolitan / municipality / rural municipality.
    -- Urban-rural comparisons depend on this being consistent.
    d.palika_type,

    {{ dbt.current_timestamp() }} as _loaded_at

from deduplicated d
inner join {{ ref('np_provinces') }} p
    on d.province_id = p.province_id
