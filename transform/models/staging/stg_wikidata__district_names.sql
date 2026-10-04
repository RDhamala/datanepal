{{ config(materialized = 'view') }}

/*
  Nepali names for Nepal's 77 current districts, from Wikidata (CC0).

  Both labels carry a type suffix the COD does not: Wikidata writes "Taplejung
  District" and "ताप्लेजुङ जिल्ला", the spine writes "Taplejung". Both come
  off, so the stored name_ne sits at the same granularity as name_en -- a
  consumer joining or printing the two columns should not get one bare form
  and one suffixed.

  The abolished pair is already excluded upstream, by Wikidata's own P576
  statement rather than by us deciding which names look historical.
*/

with source as (
    select * from {{ source('raw_wikidata_names', 'district_names') }}
),

cleaned as (
    select
        qid,
        trim(regexp_replace(name_en, '\s+District$', '', 'i')) as name_en,
        trim(regexp_replace(name_ne, '\s*जिल्ला\s*$', ''))      as name_ne,
        cast(lat as double)                                     as lat,
        cast(lon as double)                                     as lon
    from source
    where name_en is not null
      and name_ne is not null
)

select
    qid,
    name_en,
    name_ne,
    lat,
    lon,
    -- Casing, spacing and punctuation collapse in one step, as in the
    -- local-unit crosswalk.
    regexp_replace(lower(name_en), '[^a-z]', '', 'g') as match_key
from cleaned
