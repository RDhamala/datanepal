{{ config(materialized = 'table') }}

/*
  The canonical fact table.

  One row per measurement:

      dataset × indicator × place? × period × dimension-set → value

  This shape replaced an earlier one that carried `sex` and `age_band` as real
  columns. That was defensible while population was the only dataset and fails
  for almost everything else: budgets need ministry and economic classification,
  elections need candidate and party, commodity prices need commodity and
  variety, school counts need level and management. Adding a column per
  dimension produces exactly the wide table of nullable columns that becomes
  impossible to reason about at twenty datasets.

  Design decisions worth stating, because each was a real choice:

  `place_id` is NULLABLE. Not every measurement is geographic. National-only
  series attach to the country place, but a genuinely non-spatial indicator
  should not have to invent a place to exist.

  `period_start` / `period_end` are DATES, with `period_type` naming the shape.
  An integer year cannot express monthly inflation, a Nepali fiscal year
  (mid-July to mid-July, spanning two Gregorian years), or a weekly commodity
  price. A start/end pair expresses all of them, and `period_type` keeps them
  distinguishable rather than merely comparable.

  `value_numeric` and `value_text` are separate. Most observations are numbers,
  but some are categorical -- the winning party in a constituency, a
  qualitative status. Coercing those to codes in a numeric column loses their
  meaning.

  Currency and price basis live in `unit_id`, not in their own columns.
  'US dollars, current prices' and 'US dollars, constant 2015 prices' are
  different units, and treating them as one unit plus a modifier invites
  comparing them.

  `status` distinguishes a suppressed value from a zero from an unobserved one.
  A NULL value with status 'suppressed' is information; a NULL with no status is
  a bug.

  `dimension_key` is a deterministic fingerprint of the observation's dimension
  members. It exists so uniqueness is testable on this table alone, without
  joining the long dimension table -- duplicate detection is the check most
  likely to be needed and least affordable to make expensive.
*/

with population as (
    select
        'cod-ps-npl'                                as dataset_id,
        'population'                                as indicator_id,
        p.place_id,
        -- COD-PS publishes calendar-year estimates.
        make_date(s.year, 1, 1)                     as period_start,
        make_date(s.year, 12, 31)                   as period_end,
        'year'                                      as period_type,
        cast(s.population as double)                as value_numeric,
        cast(null as varchar)                       as value_text,
        'persons'                                   as unit_id,
        -- Everything after the 2021 census is a projection, and saying so is
        -- the difference between a usable figure and a misleading one.
        case when s.year <= 2021 then 'actual' else 'projection' end as status,
        s.sex,
        s.age_band
    from {{ ref('stg_hdx__population') }} s
    inner join {{ ref('int_place_identifiers') }} pi
        on pi.id_system = 'ocha_pcode' and pi.id_value = s.place_pcode
    inner join {{ ref('int_places') }} p on p.place_id = pi.place_id
),

population_shaped as (
    select
        dataset_id, indicator_id, place_id,
        period_start, period_end, period_type,
        value_numeric, value_text, unit_id, status,
        -- Dimension members, ordered canonically so the fingerprint is stable.
        [
            struct_pack(dimension_id := 'sex',       member_id := sex),
            struct_pack(dimension_id := 'age_band',  member_id := age_band)
        ] as dimensions
    from population
),

economy as (
    select
        'worldbank-npl'                             as dataset_id,
        s.indicator_id,
        p.place_id,
        make_date(s.year, 1, 1)                     as period_start,
        make_date(s.year, 12, 31)                   as period_end,
        'year'                                      as period_type,
        s.value                                     as value_numeric,
        cast(null as varchar)                       as value_text,
        s.unit_id,
        s.status,
        -- No dimensions: a national annual rate is fully identified by
        -- indicator, place, and period. This is the case the previous schema
        -- could not express without meaningless nulls in sex and age_band.
        cast([] as struct(dimension_id varchar, member_id varchar)[]) as dimensions
    from {{ ref('stg_worldbank__indicators') }} s
    inner join {{ ref('int_place_identifiers') }} pi
        on pi.id_system = 'iso_3166_1_alpha2' and pi.id_value = s.country_code
    inner join {{ ref('int_places') }} p on p.place_id = pi.place_id
),

unioned as (
    select * from population_shaped
    union all by name
    select * from economy
),

keyed as (
    select
        *,
        -- Fingerprint the dimension set. Sorting first means the key does not
        -- depend on the order a source happened to emit members in.
        case
            when len(dimensions) = 0 then 'none'
            else list_aggregate(
                list_sort(
                    list_transform(dimensions, d -> d.dimension_id || '=' || d.member_id)
                ),
                'string_agg', '|'
            )
        end as dimension_key
    from unioned
)

select
    -- Deterministic surrogate: the natural key hashed. Reproducible across
    -- builds with no sequence, which matters because the warehouse is rebuilt
    -- from scratch every run.
    'obs_' || substr(
        md5(
            dataset_id || '|' || indicator_id || '|' || coalesce(place_id, '~') || '|' ||
            cast(period_start as varchar) || '|' || cast(period_end as varchar) || '|' ||
            dimension_key
        ), 1, 16
    )                            as observation_id,

    dataset_id,
    indicator_id,
    place_id,
    period_start,
    period_end,
    period_type,
    value_numeric,
    value_text,
    unit_id,
    status,
    dimension_key,
    dimensions

from keyed
