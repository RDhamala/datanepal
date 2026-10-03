{{ config(materialized = 'table') }}

/*
  External identifiers for canonical places.

  This is the crosswalk layer. A source that keys on its own codes joins the
  geography here rather than by name matching -- the only reliable approach,
  because Nepali romanisation is not standardised and the same place appears as
  Phaktanlung, Phaktanglung, and variants across sources.

  Uniqueness is per (id_system, id_value), never global: an OCHA P-code and a
  Wikidata QID cannot collide, but two systems may both use the string '3'.

  Registering a source's identifiers here once is what lets a new connector stay
  ignorant of DataNepal's internal ids.
*/

with places as (
    select place_id, place_type, source_pcode, is_historical
    from {{ ref('int_places') }}
),

ocha as (
    select
        place_id,
        'ocha_pcode'          as id_system,
        source_pcode          as id_value,
        'cod-ab-npl'          as dataset_id,
        true                  as is_authoritative
    from places
    where source_pcode is not null
      and place_type <> 'country'
),

wikidata as (
    select
        p.place_id,
        'wikidata_qid'        as id_system,
        n.wikidata_qid        as id_value,
        'wikidata-np-places'  as dataset_id,
        false                 as is_authoritative
    from {{ ref('int_place_names_raw') }} n
    inner join places p on n.source_pcode = p.source_pcode
    where n.wikidata_qid is not null
),

iso_subdivision as (
    -- ISO 3166-2 codes for provinces, from the hand-verified seed.
    select
        p.place_id,
        'iso_3166_2'          as id_system,
        s.province_code       as id_value,
        'datanepal-internal'  as dataset_id,
        false                 as is_authoritative
    from places p
    inner join {{ ref('np_provinces') }} s
        on cast(substr(p.source_pcode, 3, 2) as integer) = s.province_id
    where p.place_type = 'province'
),

iso_country as (
    -- The World Bank and most international sources key on ISO country codes,
    -- not P-codes. Registering this is what lets a national source join without
    -- knowing anything about DataNepal internals.
    select
        place_id,
        'iso_3166_1_alpha2'   as id_system,
        'NP'                  as id_value,
        'datanepal-internal'  as dataset_id,
        true                  as is_authoritative
    from places
    where place_type = 'country'
),

country_pcode as (
    select
        place_id,
        'ocha_pcode'          as id_system,
        'NP'                  as id_value,
        'cod-ab-npl'          as dataset_id,
        true                  as is_authoritative
    from places
    where place_type = 'country'
),

historical as (
    -- Places that no longer exist have no P-code, so they need a namespace of
    -- their own to be referenceable at all. `place_successions` resolves both
    -- of its endpoints through this table, which is what lets one succession
    -- row point from a historical place to a current one without either side
    -- knowing which is which.
    select
        p.place_id,
        'datanepal_historical' as id_system,
        h.historical_id        as id_value,
        'datanepal-internal'   as dataset_id,
        true                   as is_authoritative
    from {{ ref('historical_places') }} h
    inner join places p
        on p.place_id = {{ derive_place_id('h.place_type', 'h.historical_id') }}
),

unioned as (
    select * from ocha
    union all select * from wikidata
    union all select * from iso_subdivision
    union all select * from iso_country
    union all select * from country_pcode
    union all select * from historical
)

select
    place_id,
    id_system,
    id_value,
    dataset_id,
    is_authoritative,
    cast(null as date) as valid_from,
    cast(null as date) as valid_to
from unioned
