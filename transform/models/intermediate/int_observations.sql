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


/* ------------------------------------------------------------ census 2021 */

/*
  NSO census population and households.

  Two things make this structurally unlike the UNFPA series above, and both are
  the point of adding it:

  It reaches local government, which no other source does -- 753 places that
  previously had geometry and a name but not a single statistic.

  It carries a `residence_type` dimension. Local-unit figures are household
  population; each district additionally reports institutional population
  (barracks, hostels, prisons, hospitals) belonging to no local unit. Without
  that dimension, districts would not equal the sum of their local units and
  every per-capita figure below district level would be quietly wrong by
  239,098 people nationally.
*/
census_population_long as (
    select
        pl.place_id,
        pop.level,
        -- The census reference date. A census is an enumeration on a date, not
        -- a calendar-year average, but period_type 'year' keeps it comparable
        -- with the annual series it sits beside.
        case
            when pop.level = 'institutional' then 'institutional'
            when pop.level = 'local' then 'household'
            else 'all'
        end as residence_type,
        sex_col.sex,
        sex_col.value
    from {{ ref('stg_nso__census_population') }} pop
    inner join {{ ref('stg_nso__census_places') }} pl
        on pl.level = pop.level
       and coalesce(pl.district_name, '~') = coalesce(pop.district_name, '~')
       and coalesce(pl.base_name, '~') = coalesce(pop.base_name, '~')
       -- unit_type is part of the key, not decoration: without it, two
       -- crosswalk rows differing only by type fan every observation out.
       and coalesce(pl.unit_type, '~') = coalesce(pop.unit_type, '~')
    cross join unnest([
        struct_pack(sex := 'all',    value := pop.population_total),
        struct_pack(sex := 'male',   value := pop.population_male),
        struct_pack(sex := 'female', value := pop.population_female)
    ]) as t(sex_col)
    where sex_col.value is not null
),

census_population_shaped as (
    select
        'nso-nphc-2021'                as dataset_id,
        'population'                   as indicator_id,
        place_id,
        date '2021-11-25'              as period_start,
        date '2021-11-25'              as period_end,
        'instant'                      as period_type,
        cast(value as double)          as value_numeric,
        cast(null as varchar)          as value_text,
        'persons'                      as unit_id,
        'actual'                       as status,
        [
            struct_pack(dimension_id := 'sex',            member_id := sex),
            struct_pack(dimension_id := 'residence_type', member_id := residence_type)
        ] as dimensions
    from census_population_long
),

census_households as (
    select
        'nso-nphc-2021'                          as dataset_id,
        'households'                             as indicator_id,
        pl.place_id,
        date '2021-11-25'                        as period_start,
        date '2021-11-25'                        as period_end,
        'instant'                                as period_type,
        cast(pop.households as double)           as value_numeric,
        cast(null as varchar)                    as value_text,
        'households'                             as unit_id,
        'actual'                                 as status,
        [
            struct_pack(
                dimension_id := 'residence_type',
                member_id := case
                    when pop.level = 'institutional' then 'institutional'
                    when pop.level = 'local' then 'household'
                    else 'all'
                end
            )
        ] as dimensions
    from {{ ref('stg_nso__census_population') }} pop
    inner join {{ ref('stg_nso__census_places') }} pl
        on pl.level = pop.level
       and coalesce(pl.district_name, '~') = coalesce(pop.district_name, '~')
       and coalesce(pl.base_name, '~') = coalesce(pop.base_name, '~')
       -- unit_type is part of the key, not decoration: without it, two
       -- crosswalk rows differing only by type fan every observation out.
       and coalesce(pl.unit_type, '~') = coalesce(pop.unit_type, '~')
    where pop.households is not null
),

/*
  Literacy. Published as three indicators rather than one, deliberately.

  A rate on its own cannot be re-aggregated: averaging the literacy rates of two
  local units of different sizes is wrong, and a consumer who only has the rate
  has no way to do it correctly. So the numerator and the denominator are
  published alongside it, both additive, and the rate is marked is_additive =
  false. That is the difference between publishing a number and publishing data.
*/
census_literacy_base as (
    select
        pl.place_id,
        lit.sex,
        lit.population_5plus,
        lit.can_read_and_write
    from {{ ref('stg_nso__census_literacy') }} lit
    inner join {{ ref('stg_nso__census_places') }} pl
        on pl.level = lit.level
       and coalesce(pl.district_name, '~') = coalesce(lit.district_name, '~')
       and coalesce(pl.base_name, '~') = coalesce(lit.base_name, '~')
       and coalesce(pl.unit_type, '~') = coalesce(lit.unit_type, '~')
    where lit.level in ('province', 'district', 'local')
),

census_literacy_shaped as (
    select
        'nso-nphc-2021'       as dataset_id,
        m.indicator_id,
        b.place_id,
        date '2021-11-25'     as period_start,
        date '2021-11-25'     as period_end,
        'instant'             as period_type,
        m.value               as value_numeric,
        cast(null as varchar) as value_text,
        m.unit_id,
        'actual'              as status,
        [struct_pack(dimension_id := 'sex', member_id := b.sex)] as dimensions
    from census_literacy_base b
    cross join unnest([
        struct_pack(
            indicator_id := 'population_5plus',
            unit_id := 'persons',
            value := cast(b.population_5plus as double)
        ),
        struct_pack(
            indicator_id := 'literate_population',
            unit_id := 'persons',
            value := cast(b.can_read_and_write as double)
        ),
        struct_pack(
            indicator_id := 'literacy_rate',
            unit_id := 'percent',
            -- Percent, 0-100, to match the `percent` unit. Storing a 0-1 share
            -- against a 0-100 unit is how "female share 0.5%" reached a page.
            value := case
                when b.population_5plus > 0
                then 100.0 * b.can_read_and_write / b.population_5plus
            end
        )
    ]) as t(m)
    where m.value is not null
),

unioned as (
    select * from population_shaped
    union all by name
    select * from economy
    union all by name
    select * from census_population_shaped
    union all by name
    select * from census_households
    union all by name
    select * from census_literacy_shaped
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
