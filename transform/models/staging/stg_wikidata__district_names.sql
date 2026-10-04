{{ config(materialized = 'view') }}

/*
  Nepali names for Nepal's 77 current districts, from Wikidata (CC0).

  The English label carries a type suffix the COD does not -- Wikidata writes
  "Taplejung District" where the spine writes "Taplejung" -- so that comes off
  before matching.

  The Nepali suffix stays. जिल्ला was briefly stripped, to make name_ne
  parallel the bare name_en, and that was wrong in context: every other level
  keeps its own type word, because every publisher writes it. Provinces are
  "कोशी प्रदेश" from the seed and 99.8% of local units are "... गाउँपालिका"
  from NSO. Stripping only the districts made them the one level out of step
  with the rest of the column.

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
        trim(name_ne)                                           as name_ne,
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
