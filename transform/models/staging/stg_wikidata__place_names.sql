{{ config(materialized = 'view') }}

/*
  Candidate Nepali names for local units, from Wikidata (CC0).

  Cleans both sides of the name for matching. Two problems recur:

  - English labels append the unit type inconsistently: "Phungling",
    "Phungling Municipality", and "Phungling Nagarpalika" are the same place.
    The COD publishes the bare name, so the suffix must come off before
    comparison.
  - Nepali labels sometimes carry a disambiguating district after a comma,
    e.g. "याङवरक गाउँपालिका, ताप्लेजुङ". That belongs in the district column,
    not in the name.
*/

with source as (
    select * from {{ source('raw_wikidata_names', 'place_names') }}
),

cleaned as (
    select
        qid,
        trim(name_en) as name_en,

        -- Drop any ", <district>" disambiguator from the Nepali label.
        trim(split_part(name_ne, ',', 1)) as name_ne,

        wikidata_type,

        -- Wikidata labels districts as "Taplejung District"; the COD uses the
        -- bare "Taplejung". Left unstripped, the district tier of the crosswalk
        -- matches nothing and everything silently falls through to the weaker
        -- name-only tier.
        trim(regexp_replace(district_name_en, '\s+District$', '', 'i'))
                                          as district_name_en,
        cast(lat as double)               as lat,
        cast(lon as double)               as lon
    from source
    where name_en is not null
      and name_ne is not null
)

select
    qid,
    name_en,
    name_ne,
    wikidata_type,
    district_name_en,
    lat,
    lon,

    -- Match key: strip the unit-type suffix, then everything that is not a
    -- letter. Removes casing, spacing, and punctuation differences in one step.
    regexp_replace(
        lower(
            regexp_replace(
                name_en,
                '\s+(rural municipality|sub-?metropolitan city|metropolitan city|municipality|gaunpalika|nagarpalika|gaupalika)\s*$',
                '',
                'i'
            )
        ),
        '[^a-z]', '', 'g'
    ) as match_key

from cleaned
