{{ config(materialized = 'table') }}

/*
  Published place dimension. Every place DataNepal can attach an observation to.

  Carries the OCHA P-code as a convenience column because it is what most
  consumers of Nepali data already hold -- but `place_id` is the key, and the
  full identifier set lives in place_identifiers.

  This table includes places that no longer exist. `is_current` is the filter
  almost every consumer wants, and it is derived from the validity interval
  rather than stored, because two representations of the same fact drift. See
  docs/adr/0008; `assert_current_marts_exclude_historical_places` is what stops
  an abolished district reaching a map.
*/

with places as (
    select * from {{ ref('int_places') }}
),

/*
  `superseded_by_place_id` is meaningful only where a place has exactly one
  successor -- a rename, or a straight reassignment. For a split it would have
  to pick one of several arbitrarily, so it stays NULL and the caller is pushed
  to `place_successions`, which can answer the question properly.
*/
sole_successor as (
    select predecessor_place_id, min(successor_place_id) as successor_place_id
    from {{ ref('int_place_successions') }}
    where successor_count = 1
    group by predecessor_place_id
),

slugs as (
    select
        place_id,
        trim(both '-' from regexp_replace(lower(name_en), '[^a-z0-9]+', '-', 'g')) as slug
    from places
)

select
    p.place_id,
    p.place_type,
    p.admin_level,
    p.name_en,
    /*
      NSO outranks Wikidata for a local unit's Nepali name: it is the publisher
      of record, it covers all 753, and it keys each name by the same
      romanisation the census tables use, so no spelling is matched across two
      independent transliterations. Wikidata remains the fallback and still
      supplies three of the four units excluded from NSO for a transcoding or
      truncation defect -- see nso_name_exclusions.csv.

      Resolved here rather than in int_places because the bridge to the spine
      runs through stg_nso__census_places, which is downstream of int_places,
      so feeding a name back would close a cycle. Every other mart reads names
      from this model, so coalescing once here reaches all of them.
    */
    coalesce(ln.name_ne, p.name_ne) as name_ne,
    s.slug,

    p.parent_place_id,
    par.name_en                as parent_name_en,
    pslug.slug                 as parent_slug,

    p.source_pcode             as ocha_pcode,

    p.area_sqkm,
    p.center_lat,
    p.center_lon,

    p.valid_from,
    p.valid_to,
    ({{ place_is_current('p') }})     as is_current,
    ss.successor_place_id             as superseded_by_place_id,
    p.dataset_id

from places p
left join {{ ref('int_local_unit_names') }} ln on ln.place_id = p.place_id
join slugs s               on p.place_id = s.place_id
left join places par       on p.parent_place_id = par.place_id
left join slugs pslug      on p.parent_place_id = pslug.place_id
left join sole_successor ss on p.place_id = ss.predecessor_place_id
-- Historical places sort last: they have no P-code, so ordering by it would
-- put them first on a NULLS FIRST default and make the head of the table
-- misleading to anyone eyeballing it.
order by p.is_historical, coalesce(p.admin_level, 9), p.source_pcode
