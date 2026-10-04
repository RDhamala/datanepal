/*
  One Nepali name per local unit.

  NSO ships several romanisation aliases per place, so a place can reach more
  than one row in the staging model. The crosswalk picks one deterministically;
  this asserts the pick actually happened, because a fan-out here would
  duplicate a place in the spine rather than raise.
*/

select
    place_id,
    count(*) as rows_for_this_place,
    'local unit matched to more than one Nepali name' as failure
from {{ ref('int_local_unit_names') }}
group by place_id
having count(*) > 1
