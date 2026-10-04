/*
  Nepali names cover essentially every local unit.

  NSO publishes a Devanagari name for all 753, keyed by the same romanisation
  the census tables use, so the only units without one are the handful whose
  NSO row is excluded for a named defect and which Wikidata does not cover.
  One today: Pariwartan, where NSO's Nepali name is a different name rather
  than a different spelling and no authority here settles which is current.

  Asserted as a ceiling on the gap rather than a floor on coverage, because the
  direction that matters is coverage silently collapsing -- a changed page
  shape or a renamed translation key would leave the join finding nothing, and
  nothing about the site would look broken.
*/

-- Reads the mart, not int_places: NSO is coalesced over Wikidata in
-- marts/places, because the bridge to the spine is downstream of int_places.
-- Pointed at int_places this test sees the Wikidata-only column and fails on
-- a gap that no longer exists.
with gap as (
    select count(*) as n
    from {{ ref('places') }}
    where admin_level = 3
      and place_type <> 'protected_area'
      and is_current
      and name_ne is null
)

select n, 'more local units without a Nepali name than the known residue' as failure
from gap
where n > 3
