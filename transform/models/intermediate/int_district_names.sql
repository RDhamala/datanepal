{{ config(materialized = 'table') }}

/*
  Crosswalk: district P-code -> Nepali name.

  Districts carried no Nepali name at all until now -- int_places hardcoded a
  NULL -- so all 77 district pages stated that none was published. The names
  were in a response the Wikidata connector was already fetching: its
  local-unit query binds ?district to find each palika's parent and kept only
  the English label.

  Two tiers:

    1. name  -- the normalised name agrees and is unique on both sides (67)
    2. seed  -- district_name_fixes.csv, one written reason per row    (10)

  District names are unique nationally, unlike local-unit names, 22 of which
  are shared across districts. That makes tier 1 safe *where the two sources
  spell the name the same way*, and they do not for ten of the 77:
  Dhanusa/Dhanusha, Kapilbastu/Kapilvastu, Terhathum/Tehrathum, and four
  post-2017 districts the sources name differently outright -- our
  "Nawalparasi East" is their "Nawalpur". An independent romanisation
  disagreeing with ours is exactly what got Open Knowledge Nepal's boundary
  release rejected as a name source, so none of that residue is bridged by
  edit distance.

  Eight of the ten were *derived* by point-in-polygon against the COD
  boundaries, which is a fact rather than a guess, and each seed row records
  that. The geometry is not re-run here on purpose. It would make every build
  depend on DuckDB's spatial extension -- a network fetch that fails behind a
  TLS-inspecting proxy, as profiles.yml warns -- to re-derive ten stable facts
  about districts that change on the order of once a decade. The derivation
  belongs in the commit; the result belongs in a file a human can audit.

  The remaining two could not be reached by geometry either: Parasi's
  coordinate falls outside its own polygon and Eastern Rukum's sits inside
  neighbouring Salyan. Both Nepali labels name the district unambiguously, and
  the seed says so.
*/

with spine as (
    select
        pcode                                               as source_pcode,
        name_en,
        regexp_replace(lower(name_en), '[^a-z]', '', 'g')   as match_key
    from {{ ref('stg_hdx__admin_units') }}
    where admin_level = 2
),

candidates as (
    select * from {{ ref('stg_wikidata__district_names') }}
),

-- Both sides must be unique on the key. A duplicate item on either side drops
-- to the seed rather than fanning the crosswalk out, which is the failure mode
-- that produced 755 rows for 753 local units once already.
unique_candidates as (
    select match_key from candidates group by match_key having count(*) = 1
),

unique_spine as (
    select match_key from spine group by match_key having count(*) = 1
),

tier1 as (
    select s.source_pcode, c.qid, c.name_ne, 'name' as match_method
    from spine s
    join candidates c        on s.match_key = c.match_key
    join unique_candidates u on c.match_key = u.match_key
    join unique_spine us     on s.match_key = us.match_key
),

tier2 as (
    select
        f.ocha_pcode   as source_pcode,
        f.wikidata_qid as qid,
        f.name_ne,
        'seed'         as match_method
    from {{ ref('district_name_fixes') }} f
    where f.ocha_pcode not in (select source_pcode from tier1)
)

select
    s.source_pcode,
    s.name_en,
    m.name_ne,
    m.qid                                 as wikidata_qid,
    coalesce(m.match_method, 'unmatched') as match_method
from spine s
left join (
    select * from tier1
    union all
    select * from tier2
) m on s.source_pcode = m.source_pcode
