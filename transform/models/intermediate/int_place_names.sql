{{ config(materialized = 'table') }}

/*
  Names for places, one row per (place, language, kind).

  Names live in their own table rather than as columns on places because a place
  has more than one: an official English name, an official Nepali name, historic
  names from before the 2017 restructuring, and transliteration variants that
  people actually search for. Modelling them as columns forces a choice of which
  single name is "the" name and discards the rest.

  `places` still carries a convenience primary name per language, resolved from
  here, so the common case needs no join.
*/

with places as (
    select place_id, name_en, name_ne, source_pcode, dataset_id from {{ ref('int_places') }}
),

english as (
    select
        place_id,
        'en'              as lang,
        name_en           as name,
        'official'        as name_kind,
        true              as is_primary,
        'cod-ab-npl'      as dataset_id
    from places
    where name_en is not null
),

nepali as (
    select
        place_id,
        'ne'              as lang,
        name_ne           as name,
        'official'        as name_kind,
        true              as is_primary,
        -- Provinces come from the hand-verified seed; local units from Wikidata.
        case when name_ne is not null and source_pcode like 'NP__' then 'datanepal-internal'
             else 'wikidata-np-places' end as dataset_id
    from places
    where name_ne is not null
)

select * from english
union all
select * from nepali
