{#
  Validity predicates for the place spine. See docs/adr/0008.

  A place is valid over the half-open interval [valid_from, valid_to).
  Half-open, not closed, because the alternative makes the day a boundary
  changes ambiguous: with closed intervals, 2015-09-20 belongs to both old
  Nawalparasi and its two successors, and any as-of query on that date returns
  three districts where there should be two.

  NULL means unbounded on that side. `valid_from IS NULL` is used only for the
  country and for protected areas, and reads as "no verified start date", not
  as "existed forever" -- the distinction matters when someone later finds the
  date.
#}

{#
  Currently valid. This is the filter every current-facing mart needs, and
  forgetting it is the failure mode ADR-0008 flags -- an extra map feature, or
  a page generated for a district abolished in 2015.
#}
{% macro place_is_current(alias='') %}
    {%- set p = (alias ~ '.') if alias else '' -%}
    {{ p }}valid_to is null
{% endmacro %}

{#
  Valid at a given date. Pass a date literal or a column.

      where {{ place_valid_at('p', "date '2011-06-22'") }}

  Use this rather than hand-writing the comparison: getting the half-open
  boundary wrong is silent, and it is wrong in the direction of returning too
  many places rather than too few.
#}
{% macro place_valid_at(alias, date_expr) %}
    {%- set p = (alias ~ '.') if alias else '' -%}
    ({{ p }}valid_from is null or {{ p }}valid_from <= {{ date_expr }})
    and ({{ p }}valid_to is null or {{ p }}valid_to > {{ date_expr }})
{% endmacro %}

{#
  Valid at any point during a period. An observation spanning a boundary change
  overlaps both the old place and the new one, which is a real condition and
  not necessarily an error -- a fiscal year straddling 10 March 2017 genuinely
  covers both geographies.
#}
{% macro place_overlaps_period(alias, start_expr, end_expr) %}
    {%- set p = (alias ~ '.') if alias else '' -%}
    ({{ p }}valid_from is null or {{ p }}valid_from <= {{ end_expr }})
    and ({{ p }}valid_to is null or {{ p }}valid_to > {{ start_expr }})
{% endmacro %}
