{{ config(severity = 'error', error_if = '>0') }}

/*
  The place hierarchy must be a tree rooted at the country.

  Explicit parent keys are more expressive than P-code substrings but also more
  fallible: a substring hierarchy cannot contain a cycle, an explicit one can.
  Walk the parents and assert every place reaches the root without looping.

  The depth cap is a guard, not a limit -- Nepal's hierarchy is four levels, so
  anything past ten is a cycle rather than deep nesting.
*/

with recursive walk as (
    select
        place_id,
        parent_place_id,
        1 as depth,
        place_id as origin
    from {{ ref('places') }}

    union all

    select
        p.place_id,
        p.parent_place_id,
        w.depth + 1,
        w.origin
    from walk w
    join {{ ref('places') }} p on w.parent_place_id = p.place_id
    where w.depth < 10
),

deepest as (
    select origin, max(depth) as depth
    from walk
    group by origin
)

select
    d.origin as place_id,
    p.place_type,
    p.name_en,
    d.depth,
    'parent chain exceeds expected depth; likely a cycle' as problem
from deepest d
join {{ ref('places') }} p on d.origin = p.place_id
where d.depth >= 10
