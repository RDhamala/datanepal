{{ config(severity = 'error', error_if = '>0') }}

/*
  Every seeded succession must resolve to two real places, and the pair must be
  ordered in time.

  `int_place_successions` resolves its endpoints with inner joins, so an
  unresolvable row does not error -- it disappears. That is the failure this
  platform is most exposed to generally (a partial load raises nothing and
  under-reports quietly), so the seed is counted back against the model rather
  than trusted.

  Beyond arithmetic, three conditions have to hold for a succession to mean
  anything:

  - A place cannot succeed itself.
  - A predecessor must actually be closed. If Nawalparasi was split in 2015 but
    still has valid_to NULL, then both it and its successors are current, and
    any as-of query on today returns 78 districts.
  - The predecessor must close on the date the succession took effect. A
    district that was abolished on one date and succeeded on another is one of
    the two dates being wrong.
*/

with seed_count as (
    select count(*) as n from {{ ref('place_succession_edges') }}
),
model_count as (
    select count(*) as n from {{ ref('int_place_successions') }}
),

unresolved as (
    select
        'seeded succession did not resolve to two known places' as problem,
        cast(null as varchar)  as predecessor_place_id,
        cast(null as varchar)  as successor_place_id,
        cast(null as date)     as effective_date
    from seed_count s, model_count m
    where s.n <> m.n
),

bad_edges as (
    select
        case
            when s.predecessor_place_id = s.successor_place_id
                then 'place succeeds itself'
            when pre.valid_to is null
                then 'predecessor has a successor but is still open'
            when pre.valid_to <> s.effective_date
                then 'predecessor closes on a different date than the succession'
        end                    as problem,
        s.predecessor_place_id,
        s.successor_place_id,
        s.effective_date
    from {{ ref('int_place_successions') }} s
    join {{ ref('places') }} pre on pre.place_id = s.predecessor_place_id
)

select * from unresolved
union all
select * from bad_edges where problem is not null
