{{ config(materialized = 'table') }}

/*
  Long-format dimension members per observation.

  Unnested from the struct list carried on int_observations. Published as its
  own table so dimension membership is queryable and, more importantly,
  *validatable* -- a foreign key to dimension_members is what makes an invalid
  member a build failure rather than a surprise in a chart.

  An observation with no dimensions has no rows here. That is the normal case
  for a scalar national indicator.
*/

select
    o.observation_id,
    d.dimension_id,
    d.member_id
from {{ ref('int_observations') }} o
cross join unnest(o.dimensions) as t(d)
