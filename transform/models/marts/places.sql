{{ config(materialized = 'table') }}

/*
  Published place dimension: every addressable place in Nepal, all levels.

  This is what generates the site's URLs, so it carries the slug. Slugs are
  derived from the English name and are unique within a parent, which is what
  makes the hierarchical URL scheme safe: 22 local-unit names are shared
  nationally, but none collide inside the same district.
*/

with base as (
    select
        place_pcode,
        admin_level,
        place_type,
        name_en,
        name_ne,
        parent_pcode,
        area_sqkm,
        center_lat,
        center_lon,
        -- Lowercase, non-alphanumerics to single hyphens, trimmed.
        trim(both '-' from regexp_replace(lower(name_en), '[^a-z0-9]+', '-', 'g')) as slug
    from {{ ref('int_places') }}
)

select
    b.*,
    par.name_en as parent_name_en,
    par.slug    as parent_slug
from base b
left join base par on b.parent_pcode = par.place_pcode
order by b.admin_level, b.place_pcode
