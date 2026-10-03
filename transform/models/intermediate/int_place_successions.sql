{{ config(materialized = 'table') }}

/*
  What became of what. See docs/adr/0008.

  One row per (predecessor, successor) edge. A split is one predecessor with
  several successors; a merge is several predecessors with one successor. That
  is why this is an edge table and not a column on `places` -- a column can
  express a rename and nothing else.

  Both endpoints are resolved through `int_place_identifiers` rather than named
  directly, so a seed row can point from a historical place (which has no
  P-code) to a current one (which has no historical id) without either side
  having to know DataNepal's internal surrogates. The resolution is an inner
  join on purpose: a succession naming a place that does not exist is a broken
  reference, and `assert_place_successions_resolve` reports exactly which one
  rather than letting the row vanish.

  `share_value` is almost always NULL, and that is the design. Apportioning a
  predecessor's statistics across its successors requires a model -- area
  weights, population weights, a boundary intersection -- and this platform does
  not publish modelled figures next to enumerated ones without labelling them.
  A share is recorded only where the split is exact and the basis says so.
*/

-- The seed is `place_succession_edges`, not `place_successions`: the published
-- mart owns the latter name, and dbt resolves seeds and models in one
-- namespace.
with seed as (
    select * from {{ ref('place_succession_edges') }}
),

ids as (
    select id_system, id_value, place_id from {{ ref('int_place_identifiers') }}
),

resolved as (
    select
        pre.place_id      as predecessor_place_id,
        suc.place_id      as successor_place_id,
        s.succession_type,
        s.effective_date,
        s.share_basis,
        s.share_value,
        s.instrument,
        s.note
    from seed s
    inner join ids pre
        on pre.id_system = s.predecessor_id_system
       and pre.id_value  = s.predecessor_id_value
    inner join ids suc
        on suc.id_system = s.successor_id_system
       and suc.id_value  = s.successor_id_value
)

select
    -- Deterministic surrogate, same reasoning as observation_id: the warehouse
    -- is rebuilt from scratch, so a sequence would renumber every build.
    'sc_' || substr(
        md5(predecessor_place_id || '|' || successor_place_id || '|'
            || cast(effective_date as varchar)), 1, 12
    )                                as succession_id,

    predecessor_place_id,
    successor_place_id,
    succession_type,
    effective_date,
    share_basis,
    share_value,
    instrument,
    note,

    -- How many successors this predecessor has. Carried on the row because the
    -- 1:1 case is the only one where `superseded_by_place_id` is meaningful,
    -- and the mart needs to know which rows those are without re-aggregating.
    count(*) over (partition by predecessor_place_id, effective_date)
                                     as successor_count,

    'datanepal-internal'             as dataset_id

from resolved
order by effective_date, predecessor_place_id, successor_place_id
