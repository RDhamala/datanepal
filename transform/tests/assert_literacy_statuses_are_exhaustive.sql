{{ config(severity = 'error', error_if = '>0') }}

/*
  The literacy status columns must account for the whole 5-plus population.

  NSO reports four statuses plus a not-stated residual. They should sum exactly
  to the published 5-plus total. If a future release adds a category we do not
  read, the literacy rate silently gains a denominator it does not use -- every
  rate would shift slightly and nothing would look broken.

  A tolerance of zero is correct here: these are counts from a single table, not
  independently produced figures.
*/

select
    row_id,
    population_5plus,
    can_read_and_write + can_read_only + cannot_read_or_write + literacy_not_stated
        as status_sum,
    population_5plus
        - (can_read_and_write + can_read_only + cannot_read_or_write + literacy_not_stated)
        as difference
from {{ ref('stg_nso__census_literacy') }}
where population_5plus
    <> can_read_and_write + can_read_only + cannot_read_or_write + literacy_not_stated
