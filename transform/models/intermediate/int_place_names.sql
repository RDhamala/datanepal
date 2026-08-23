{{ config(materialized = 'table') }}

/*
  Crosswalk: local unit P-code -> Nepali name.

  Matching is tiered, most-trustworthy first, and every row records which tier
  produced it so the crosswalk can be audited rather than taken on faith:

    1. district + name   -- district disambiguates the 22 shared place names
                            (four places named Madi, four named Tribeni)
    2. name, globally unique -- safe only when exactly one candidate exists
                            nationally, otherwise it could attach the wrong
                            district's name

  Unmatched units get a NULL name_ne. That is deliberate. Nepali romanisation
  is not standardised -- the COD's "Phaktanlung" and Wikidata's spelling of the
  same place differ -- so transliterating the gap would produce plausible,
  unverifiable, wrong names in a reference dataset other people build on. A
  visible gap is recoverable; a silent error is not.

  Fuzzy and geometry-based matching (Wikidata carries P625 coordinates, the COD
  carries centroids) are the next tiers to add and should close most of the
  remainder.
*/

with spine as (
    select
        palika_pcode,
        palika_name_en,
        district_name_en,
        regexp_replace(lower(palika_name_en), '[^a-z]', '', 'g') as match_key
    from {{ ref('int_geography') }}
),

candidates as (
    select * from {{ ref('stg_wikidata__place_names') }}
),

-- Tier 1: district and name both agree.
tier1 as (
    select
        s.palika_pcode,
        c.name_ne,
        c.qid,
        'district+name' as match_method
    from spine s
    inner join candidates c
        on s.match_key = c.match_key
       and lower(s.district_name_en) = lower(c.district_name_en)
),

-- Tier 2: name matches and is unique nationally among candidates.
unique_names as (
    select match_key
    from candidates
    group by match_key
    having count(*) = 1
),

tier2 as (
    select
        s.palika_pcode,
        c.name_ne,
        c.qid,
        'unique-name' as match_method
    from spine s
    inner join candidates c on s.match_key = c.match_key
    inner join unique_names u on c.match_key = u.match_key
    where s.palika_pcode not in (select palika_pcode from tier1)
),

all_matches as (
    select * from tier1
    union all
    select * from tier2
),

matched as (
    -- A crosswalk must be 1:1. Wikidata can hold more than one item for the
    -- same place -- a city and its administrative unit, or a duplicate that
    -- was never merged -- so a single palika can match several candidates even
    -- within one district. Keep one, deterministically by QID so the choice is
    -- stable across runs rather than dependent on scan order.
    select palika_pcode, name_ne, qid, match_method
    from (
        select
            *,
            row_number() over (
                partition by palika_pcode
                order by
                    case match_method when 'district+name' then 0 else 1 end,
                    qid
            ) as pick
        from all_matches
    )
    where pick = 1
)

select
    s.palika_pcode,
    s.palika_name_en,
    m.name_ne                                as palika_name_ne,
    m.qid                                    as wikidata_qid,
    coalesce(m.match_method, 'unmatched')    as match_method,
    m.name_ne is not null                    as has_nepali_name
from spine s
left join matched m on s.palika_pcode = m.palika_pcode
