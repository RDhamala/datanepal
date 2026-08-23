{{ config(severity = 'error', error_if = '>0') }}

/*
  Rates, ratios, and per-capita measures must be marked non-additive.

  Summing inflation across provinces, or averaging GDP per capita unweighted,
  produces a plausible number that is wrong. The is_additive flag is what lets a
  consumer refuse to do that -- so a unit that is inherently a ratio must not be
  attached to an indicator claiming additivity.

  Currency amounts are additive (remittances sum); currency *per capita* is not,
  which is why the unit table distinguishes them.
*/

select
    i.indicator_id,
    i.name_en,
    u.unit_id,
    u.unit_kind,
    'a ratio or index unit on an indicator marked additive' as problem
from {{ ref('indicators') }} i
join {{ ref('units') }} u on i.default_unit_id = u.unit_id
where i.is_additive
  and u.unit_kind in ('ratio', 'index')
