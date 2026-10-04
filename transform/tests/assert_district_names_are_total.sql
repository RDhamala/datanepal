/*
  Every one of Nepal's 77 districts has a Nepali name.

  An external expectation, not an internal consistency check. Wikidata
  publishes a Nepali label for all 77, so a shortfall means the crosswalk
  broke -- a changed label, a moved coordinate, a renamed district, or a
  truncated SPARQL response that still returned 200.

  Without this the failure is silent and nearly invisible: a district stops
  showing its Nepali name on a page that already carries a sentence explaining
  that some places have none, so the gap reads as expected rather than broken.
*/

select
    source_pcode,
    name_en,
    'district has no Nepali name' as failure
from {{ ref('int_district_names') }}
where name_ne is null
