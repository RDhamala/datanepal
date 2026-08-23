{{ config(severity = 'error', error_if = '>0') }}

/*
  Every dimension member used by an observation must be declared.

  This is the check that makes extensible dimensions safe. Without it, a
  connector can invent 'Female', 'F', and 'female' as three distinct members and
  nothing complains until a chart shows three series where there should be two.
  A new dataset is expected to add rows to dimension_members -- it is not
  permitted to introduce members implicitly.
*/

select
    od.dimension_id,
    od.member_id,
    count(*) as observations_affected
from {{ ref('observation_dimensions') }} od
left join {{ ref('dimension_members') }} dm
    on od.dimension_id = dm.dimension_id
   and od.member_id = dm.member_id
where dm.member_id is null
group by 1, 2
