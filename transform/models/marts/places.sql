{{ config(materialized = 'table') }}

/*
  Published place dimension. Every place DataNepal can attach an observation to.

  Carries the OCHA P-code as a convenience column because it is what most
  consumers of Nepali data already hold -- but `place_id` is the key, and the
  full identifier set lives in place_identifiers.
*/

with places as (
    select * from {{ ref('int_places') }}
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
    p.name_ne,
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
    p.superseded_by_place_id,
    p.dataset_id

from places p
join slugs s          on p.place_id = s.place_id
left join places par  on p.parent_place_id = par.place_id
left join slugs pslug on p.parent_place_id = pslug.place_id
order by coalesce(p.admin_level, 9), p.source_pcode
