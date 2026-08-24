{{ config(severity = 'error', error_if = '>0') }}

/*
  Every census area must resolve to a place. No exceptions, no silent drops.

  The census carries no P-codes, so this join runs on name and type. That makes
  it the most fragile join in the project and the one most worth guarding: a
  place that fails to resolve does not error, it just vanishes, and a local
  government page renders "no data" rather than "we failed to load this".

  It also guards the crosswalk in nso_name_fixes from the other direction. If
  NSO corrects "Melanchi" to "Melamchi" in a future release, that crosswalk row
  stops matching anything -- and because the direct match then succeeds, nothing
  breaks. But if NSO renames a unit we have no fix for, this fails, which is
  what we want.
*/

with areas as (
    select distinct level, district_name, base_name
    from {{ ref('stg_nso__census_population') }}
    union
    select distinct level, district_name, base_name
    from {{ ref('stg_nso__census_literacy') }}
)

select
    a.level,
    a.district_name,
    a.base_name,
    'census area did not resolve to a canonical place' as problem
from areas a
left join {{ ref('stg_nso__census_places') }} p
    on p.level = a.level
   and coalesce(p.district_name, '~') = coalesce(a.district_name, '~')
   and coalesce(p.base_name, '~') = coalesce(a.base_name, '~')
where p.place_id is null
