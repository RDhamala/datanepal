{{ config(materialized = 'table') }}

/*
  Dataset registry: every upstream dataset, with publisher and acquisition source
  resolved to names.

  The publisher/acquisition distinction is the point. "Who produced this?" and
  "where did this copy come from?" are different questions with different
  consequences: attribution follows the publisher, while freshness, ingestion
  fragility, and the review bar follow the acquisition path.

  Concretely, the COD population data is published by UNFPA and acquired from
  HDX. Citing HDX as the publisher would be wrong, and citing UNFPA as the
  acquisition path would make the pipeline impossible to debug.
*/

with d as (select * from {{ ref('datasets') }})

select
    d.dataset_id,
    d.title,

    -- Who produced it
    d.publisher_org_id,
    pub.name_en                     as publisher_name_en,
    pub.name_ne                     as publisher_name_ne,
    pub.org_type                    as publisher_type,
    pub.homepage                    as publisher_homepage,
    d.source_tier,

    -- Where this copy came from
    d.acquired_from_org_id,
    acq.name_en                     as acquired_from_name_en,
    d.acquisition_method,
    d.acquisition_url,
    d.publisher_org_id <> d.acquired_from_org_id as acquired_indirectly,

    d.url,
    d.licence_id,
    d.licence_statement_url,
    d.commercial_reuse,
    d.rights_review_status,

    d.retrieved,
    d.vintage,
    d.time_coverage,
    d.geographic_granularity,
    d.methodology_url,
    d.update_frequency,
    d.revises_published_values,
    d.ingestion_difficulty

from d
left join {{ ref('organisations') }} pub on d.publisher_org_id = pub.org_id
left join {{ ref('organisations') }} acq on d.acquired_from_org_id = acq.org_id
order by d.source_tier, d.dataset_id
