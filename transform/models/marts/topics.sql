{{ config(materialized = 'table') }}

/*
  Topics: the browse dimension.

  Distinct from indicators and datasets on purpose. A topic answers "what should
  I know about this subject across Nepal?", an indicator answers "what exactly
  is this statistic?", and a dataset answers "who published this and how may I
  reuse it?". Collapsing them produces a site that is either a list of files or
  a list of numbers, neither of which is navigable.

  `status` distinguishes topics with data from topics we intend to cover. The
  frontend must not render a planned topic as though it were populated -- an
  empty section reads as a broken page, not a roadmap.
*/

with t as (select * from {{ ref('topics') }}),

indicator_counts as (
    select topic_id, count(*) as indicator_count
    from {{ ref('indicators') }}
    group by topic_id
),

observation_counts as (
    select i.topic_id, count(*) as observation_count
    from {{ ref('observations') }} o
    join {{ ref('indicators') }} i on o.indicator_id = i.indicator_id
    group by i.topic_id
)

select
    t.topic_id,
    t.name_en,
    t.name_ne,
    t.slug,
    t.description,
    t.sort_order,
    t.status,
    coalesce(ic.indicator_count, 0)   as indicator_count,
    coalesce(oc.observation_count, 0) as observation_count
from t
left join indicator_counts ic  on t.topic_id = ic.topic_id
left join observation_counts oc on t.topic_id = oc.topic_id
order by t.sort_order
