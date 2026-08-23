{{ config(severity = 'error', error_if = '>0') }}

/*
  A dataset may not reach the published tables until its reuse rights have been
  looked at.

  "Publicly accessible" is not "commercially reusable", and DataNepal may become
  revenue-generating. A dataset whose commercial_reuse is 'unclear' or whose
  rights_review_status is 'not_reviewed' has not been assessed -- publishing it
  and deciding later is the wrong order, because reusers will already have
  relied on whatever terms we implied.

  This is deliberately a build failure rather than a warning. A warning about
  licensing is a warning nobody reads until it matters.
*/

with published as (
    select distinct ts.dataset_id
    from {{ ref('table_sources') }} ts
),

flagged as (
    select
        d.dataset_id,
        d.title,
        d.licence_id,
        d.commercial_reuse,
        d.rights_review_status
    from {{ ref('datasets') }} d
    inner join published p on d.dataset_id = p.dataset_id
    where d.rights_review_status = 'not_reviewed'
       or d.commercial_reuse = 'unclear'
       or d.licence_id = 'unknown'
)

select
    dataset_id,
    title,
    licence_id,
    commercial_reuse,
    rights_review_status,
    'feeds a published table but its reuse rights are unreviewed or unclear' as problem
from flagged
