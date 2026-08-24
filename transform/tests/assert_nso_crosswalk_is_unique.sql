{{ config(severity = 'error', error_if = '>0') }}

/*
  One crosswalk row per census area. Not one-or-more.

  A crosswalk that resolves an area to two places does not fail loudly -- it
  fans every observation for that area out into duplicates, which then inflate
  every sum built on them. That happened here: the literacy table labelled
  institutional rows with unit_type 'institutional' while the population table
  left it null, the crosswalk held 154 rows instead of 77, and 308 duplicate
  observations resulted. The uniqueness test on observation_id caught it, but by
  then the arithmetic was already wrong.

  So the crosswalk is checked at its own grain, where the cause is visible
  rather than the symptom.
*/

select
    level,
    district_name,
    base_name,
    unit_type,
    count(*) as rows_for_this_area
from {{ ref('stg_nso__census_places') }}
group by 1, 2, 3, 4
having count(*) > 1
