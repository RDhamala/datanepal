{{ config(materialized = 'table') }}

/*
  The crosswalk: NSO census area names to canonical place_ids.

  This is the only place in the project that resolves a place by name, and it
  exists because NSO's census tables carry no P-codes -- there is no identifier
  to join on. Everything about it is therefore built to fail loudly rather than
  match approximately.

  The match key is (district, base name, unit type), not name alone. The type
  comes from the name's own suffix -- "Gaunpalika", "Municipality" -- and is
  required to agree with the spine's place_type. That second condition is what
  stops a municipality being paired with a rural municipality of the same name,
  which the district-and-name key alone would allow: 22 local-unit names are
  shared across districts, and names repeat within a district across types.

  Normalisation folds case, punctuation and spacing. It does not transliterate,
  and it does not do edit-distance or phonetic matching. Nepali romanisation is
  not standardised, and a fuzzy matcher here would attach real census figures to
  the wrong village -- silently, and in a reference dataset other people build
  on.

  This resolves 751 of 753 local units directly. The remaining two are corrected
  by nso_name_fixes, a two-row committed seed with a written reason for each.
  assert_nso_census_join_is_total fails the build if any area fails to resolve,
  so if NSO fixes a spelling and a crosswalk row stops matching, we hear about
  it rather than losing a place.
*/

with fixes as (
    select
        {{ nso_norm('district_name') }} as district_key,
        {{ nso_norm('nso_name') }}      as nso_key,
        {{ nso_norm('spine_name') }}    as spine_key
    from {{ ref('nso_name_fixes') }}
),

-- Every distinct area the census reports, at whatever level.
areas as (
    select distinct level, province_name, district_name, base_name, unit_type
    from {{ ref('stg_nso__census_population') }}
    union
    select distinct level, province_name, district_name, base_name, unit_type
    from {{ ref('stg_nso__census_literacy') }}
),

-- Apply the committed name corrections before matching.
corrected as (
    select
        a.*,
        coalesce(f.spine_key, {{ nso_norm('a.base_name') }}) as match_key
    from areas a
    left join fixes f
        on f.district_key = {{ nso_norm('a.district_name') }}
       and f.nso_key = {{ nso_norm('a.base_name') }}
),

spine_local as (
    select
        p.place_id,
        p.place_type,
        {{ nso_norm('p.name_en') }} as name_key,
        {{ nso_norm('d.name_en') }} as district_key
    from {{ ref('int_places') }} p
    inner join {{ ref('int_places') }} d on d.place_id = p.parent_place_id
    where p.place_type in ('metropolitan', 'sub_metropolitan',
                           'municipality', 'rural_municipality')
),

spine_district as (
    select p.place_id, {{ nso_norm('p.name_en') }} as name_key
    from {{ ref('int_places') }} p
    where p.place_type = 'district'
),

spine_country as (
    select p.place_id, {{ nso_norm('p.name_en') }} as name_key
    from {{ ref('int_places') }} p
    where p.place_type = 'country'
),

spine_province as (
    select p.place_id, {{ nso_norm('p.name_en') }} as name_key
    from {{ ref('int_places') }} p
    where p.place_type = 'province'
),

resolved as (
    -- Local units: district + name + type must all agree.
    select
        c.level, c.province_name, c.district_name, c.base_name, c.unit_type,
        s.place_id
    from corrected c
    inner join spine_local s
        on s.district_key = {{ nso_norm('c.district_name') }}
       and s.name_key = c.match_key
       and s.place_type = c.unit_type
    where c.level = 'local'

    union all

    -- Districts and provinces: unique by name nationally, so name is enough.
    select c.level, c.province_name, c.district_name, c.base_name, c.unit_type, s.place_id
    from corrected c
    inner join spine_district s on s.name_key = c.match_key
    where c.level = 'district'

    union all

    select c.level, c.province_name, c.district_name, c.base_name, c.unit_type, s.place_id
    from corrected c
    inner join spine_province s on s.name_key = c.match_key
    where c.level = 'province'

    union all

    select c.level, c.province_name, c.district_name, c.base_name, c.unit_type, s.place_id
    from corrected c
    inner join spine_country s on s.name_key = c.match_key
    where c.level = 'country'

    union all

    -- Institutional population is reported per district and belongs to no local
    -- unit, so it resolves to its district and is distinguished by a dimension.
    select c.level, c.province_name, c.district_name, c.base_name, c.unit_type, s.place_id
    from corrected c
    inner join spine_district s on s.name_key = {{ nso_norm('c.district_name') }}
    where c.level = 'institutional'
)

select
    level,
    province_name,
    district_name,
    base_name,
    unit_type,
    place_id
from resolved
