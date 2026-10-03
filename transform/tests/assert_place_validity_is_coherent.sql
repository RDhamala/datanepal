{{ config(severity = 'error', error_if = '>0') }}

/*
  Validity intervals must make sense on their own terms.

  Four ways an interval can be wrong, all silent:

  - It ends before it starts. Nothing errors; as-of queries simply return
    nothing for that place, at every date.
  - A currently-valid place has a valid_to. `is_current` is derived from
    valid_to being NULL, so a place with an end date in the future would read
    as historical today and flip without anything changing.
  - A place is flagged historical but has no end date, or vice versa. The flag
    and the interval are two statements of the same fact and must agree --
    which is the argument for deriving `is_current` rather than storing it, and
    the reason `is_historical` needs checking against the dates it came from.
  - A current administrative place has no start date. Only the country and
    protected areas are allowed an open start, and both are deliberate; a
    province or local unit without one means the seed lost a row.
*/

with p as (select * from {{ ref('int_places') }})

select place_id, name_en, place_type, valid_from, valid_to, is_historical, problem
from (
    select
        *,
        case
            when valid_from is not null and valid_to is not null
                 and valid_to <= valid_from
                then 'valid_to is not after valid_from'

            when is_historical and valid_to is null
                then 'flagged historical but has no end date'

            when not is_historical and valid_to is not null
                then 'currently sourced but carries an end date'

            when valid_from is null
                 and place_type not in ('country', 'protected_area')
                then 'no start date, and not one of the types allowed an open start'
        end as problem
    from p
)
where problem is not null
