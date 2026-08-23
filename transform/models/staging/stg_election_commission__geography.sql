{{ config(materialized = 'view') }}

/*
  Cleaned geography listing from the Election Commission.

  Staging does renaming, typing, and trimming only -- no joins, no derived
  measures. Anything requiring another table belongs in intermediate/.
*/

with source as (
    select * from {{ source('raw_election_commission', 'geography') }}
),

cleaned as (
    select
        cast(province_id as integer)                as province_id,
        cast(district_id as integer)                as district_id,
        cast(palika_id   as integer)                as palika_id,

        -- Source strings carry inconsistent whitespace, including non-breaking
        -- spaces that survive a plain trim() and silently break joins.
        trim(replace(district_name, chr(160), ' '))  as district_name_ne,
        trim(replace(palika_name,   chr(160), ' '))  as palika_name_ne,

        -- Normalise the local-unit type from its Nepali label.
        --
        -- Order matters and is not arbitrary. These labels nest as substrings:
        --   उपमहानगरपालिका (sub-metro) contains महानगरपालिका (metro),
        --   which in turn contains नगरपालिका (municipality).
        -- Matching general-to-specific would label every sub-metropolitan city
        -- as metropolitan, and every municipality type as a plain municipality.
        -- Always test the longest label first.
        case
            when palika_name like '%उपमहानगरपालिका%'  then 'sub_metropolitan'
            when palika_name like '%महानगरपालिका%'    then 'metropolitan'
            when palika_name like '%गाउँपालिका%'      then 'rural_municipality'
            when palika_name like '%नगरपालिका%'       then 'municipality'
            else null
        end                                          as palika_type

    from source
    where palika_id is not null
)

select * from cleaned
