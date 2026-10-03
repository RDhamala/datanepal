{{ config(materialized = 'table') }}

/*
  Published lineage: which places became which, and when.

  Denormalised with names on both sides, because the audience for this table is
  someone reconciling an old dataset against current geography and a table of
  opaque surrogates would send them straight back to `places` to make it
  readable.

  Read it in either direction. "What is Nawalparasi now" filters on
  predecessor; "what was Nawalparasi West before" filters on successor.

  `share_value` is NULL wherever apportioning the predecessor's figures would
  require a model. That is not missing data -- it is the platform declining to
  publish an estimate as though it were a source figure. See docs/adr/0008.
*/

select
    s.succession_id,

    s.predecessor_place_id,
    pre.name_en                 as predecessor_name_en,
    pre.name_ne                 as predecessor_name_ne,
    pre.place_type              as predecessor_place_type,

    s.successor_place_id,
    suc.name_en                 as successor_name_en,
    suc.name_ne                 as successor_name_ne,
    suc.place_type              as successor_place_type,

    s.succession_type,
    s.effective_date,

    -- The basis on which a share was computed, where one is given. A share
    -- without its basis is uninterpretable: 0.6 of the area and 0.6 of the
    -- population are different claims.
    s.share_basis,
    s.share_value,

    s.instrument,
    s.note,
    s.dataset_id

from {{ ref('int_place_successions') }} s
inner join {{ ref('places') }} pre on pre.place_id = s.predecessor_place_id
inner join {{ ref('places') }} suc on suc.place_id = s.successor_place_id
order by s.effective_date, pre.name_en, suc.name_en
