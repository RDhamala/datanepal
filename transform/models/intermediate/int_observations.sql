{{ config(materialized = 'table') }}

/*
  The canonical fact table. One row per measurement:

      place × indicator × period × dimensions -> value

  Every dataset on the platform lands here in the same shape. That is what
  makes the frontend generic: a chart, a comparison, or a place page works
  against any indicator without bespoke code per dataset. Adding a dataset
  should mean writing a connector and a staging model, not a new UI.

  Shape decisions, taken after looking at real Nepali data rather than in the
  abstract:

  - `sex` and `age_band` are first-class columns, not a generic dimension bag.
    Nepal's demographic sources almost all break down this way, and promoting
    the two common dimensions keeps the table queryable with plain SQL. Sources
    without them use 'all', so a naive `where sex = 'all'` never silently
    double-counts.

  - `admin_level` is carried alongside `place_pcode` because the platform mixes
    grains deliberately: World Bank indicators are national only, COD-PS reaches
    district, and the census will reach ward. Filtering by level is the common
    access pattern, and deriving it from P-code length at query time is the kind
    of cleverness that eventually goes wrong.

  - `period` is a year integer for now. Sub-annual sources (monthly food prices)
    will need a period_start/period_end pair; deferred until one exists rather
    than guessed at.

  Totals and their components coexist here (sex='all' alongside 'female' and
  'male'). Consumers must filter, not sum. That is the standard trade-off for
  long-format facts and is cheaper than materialising every rollup.
*/

with population as (
    select
        place_pcode,
        admin_level,
        'population'         as indicator_code,
        year                 as period,
        sex,
        age_band,
        cast(population as bigint) as value,
        'persons'            as unit,
        'cod-ps-npl'         as source_id
    from {{ ref('stg_hdx__population') }}
)

-- As datasets land, union them in here. Each must arrive already conformed to
-- (place_pcode, admin_level, indicator_code, period, sex, age_band, value,
-- unit, source_id) -- conforming happens in the source's staging model, not
-- here, so this stays a list rather than a pile of special cases.
select * from population
