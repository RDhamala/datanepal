{{ config(materialized = 'table') }}

/*
  Local unit -> Nepali name, from NSO, the publisher of record.

  This is the preferred source; Wikidata remains the fallback and is applied in
  the places mart, where int_places' own value is already in scope. Keeping the
  fallback there rather than here is not a style choice: the bridge to the
  spine runs through stg_nso__census_places, which is downstream of int_places,
  so a model that fed a name back into int_places would close a cycle.

  NSO outranks Wikidata on authority, and on something more useful: it keys
  each Devanagari name by the unit's *romanised* name in the same romanisation
  as the census tables, so the two sides join on a string both already agree
  on. That is why this gap stayed open while 483 Wikidata matches were
  possible -- matching across two independent romanisations is the problem
  that got Open Knowledge Nepal's release rejected, and NSO sidesteps it by
  being both sides at once.

  The bridge to the spine is the census join that already exists and is
  already asserted total: stg_nso__census_places resolves
  (province, district, base_name) -> place_id for all 753, and
  (province, district, base_name) is unique across them. So a census row
  carries both the romanised name NSO's bundle is keyed by and the place_id
  the spine uses, and no new matching is invented here.

  Where both sources have a name they agree on 379 of 482. The 103
  disagreements are almost entirely orthographic -- ि against ी, ङ against
  ङ्ग -- and NSO is consistently the cleaner form: Wikidata abbreviates
  "दसरथचन्द न.पा." where NSO writes नगरपालिका in full. Preferring NSO also
  makes the column internally consistent, which Wikidata alone never was: 76%
  of its names carry the unit-type suffix and 24% do not.
*/

with census as (
    -- One row per local unit, carrying the romanised name NSO keys its
    -- Nepali bundle by.
    select distinct
        s.place_id,
        c.raw_name,
        regexp_replace(lower(c.raw_name), '[^a-z]', '', 'g') as match_key
    from {{ source('raw_nso_census', 'census_population') }} c
    inner join {{ ref('stg_nso__census_places') }} s
        on  s.province_name = c.province_name
        and s.district_name = c.district_name
        and s.base_name     = c.base_name
        and s.level         = 'local'
    where c.raw_name is not null
),

excluded as (
    select regexp_replace(lower(name_en), '[^a-z]', '', 'g') as match_key
    from {{ ref('nso_name_exclusions') }}
),

nso as (
    select
        c.place_id,
        n.name_ne,
        'nso' as name_source
    from census c
    inner join {{ ref('stg_nso__local_unit_names') }} n
        on c.match_key = n.match_key
    where c.match_key not in (select match_key from excluded)
)

-- One place can reach several aliases that resolve to the same name; keep one
-- deterministically so the crosswalk stays 1:1 whatever the scan order.
select place_id, name_ne, name_source
from (
    select *, row_number() over (partition by place_id order by name_ne) as pick
    from nso
)
where pick = 1
