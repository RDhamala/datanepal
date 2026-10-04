{{ config(materialized = 'view') }}

/*
  Devanagari names for local units, from NSO's Nepali-language results site.

  Keyed by the unit's romanised name *including* its type suffix -- "Phungling
  Municipality" -- which is the same shape as `raw_name` in the census tables.
  That is what makes this a join rather than a transliteration: both sides are
  the same publisher's own romanisation, so no spelling has to be guessed
  across sources.

  NSO ships its own aliases, several romanisations pointing at one Devanagari
  name, so the row count exceeds 753. That is the point and not a duplicate:
  whichever spelling the census tables happen to use is covered.
*/

with source as (
    select * from {{ source('raw_nso_census', 'local_unit_names') }}
),

cleaned as (
    select
        trim(name_en)                       as name_en,
        regexp_replace(trim(name_ne), '\s+', ' ', 'g') as name_ne
    from source
    where name_en is not null
      and name_ne is not null
)

select
    name_en,
    name_ne,
    -- Casing, spacing and punctuation collapse in one step, matching the
    -- normalisation used on the census side.
    regexp_replace(lower(name_en), '[^a-z]', '', 'g') as match_key
from cleaned
