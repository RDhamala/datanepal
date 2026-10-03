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
  - An administrative place that still exists has no start date. The country
    and protected areas are allowed an open start deliberately; a province or
    local unit without one means the seed lost a row.

    A place that no longer exists is allowed one too, and for the same reason
    the country is: `valid_from IS NULL` means "valid from before anything
    this platform covers". Nawalparasi and Rukum were districts under the
    zonal structure that preceded the 2015 constitution, and the date they
    were created is not in any source this project holds. Writing 1962 from
    general knowledge would be inventing a citation, which is the one thing
    the spine refuses to do -- the same rule that leaves a romanised name
    without a Devanagari form rather than transliterating it. The gap is the
    honest record, and assert_observations_use_places_valid_at_period is what
    keeps an open start from being load-bearing: nothing may attach an
    observation to a place before it existed, open start or not.
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
                 and not is_historical
                 and place_type not in ('country', 'protected_area')
                then 'no start date, and not one of the types allowed an open start'
        end as problem
    from p
)
where problem is not null
