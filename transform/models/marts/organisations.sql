{{ config(materialized = 'table') }}

/*
  The source registry: every organisation DataNepal cites, as a publisher, an
  acquisition source, or both.

  Kept separate from datasets because the relationship is many-to-many in both
  directions: one organisation publishes several datasets, and one dataset has a
  publisher and possibly a different acquisition source. Naming an institution
  once means its Nepali name, homepage, and tier are stated once.

  source_tier records provenance authority, not technical quality. A Tier A
  ministry publishing a badly-formatted PDF is still more authoritative than a
  Tier C aggregator's clean CSV of the same numbers.
*/

select
    org_id,
    name_en,
    name_ne,
    org_type,
    jurisdiction,
    homepage,
    source_tier,
    default_licence_id,
    status,
    notes
from {{ ref('organisations') }}
order by source_tier, org_id
