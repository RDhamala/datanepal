{{ config(materialized = 'table') }}

/*
  Canonical places. One row per place, whatever its type.

  Two departures from the previous model, both deliberate:

  1. `place_id` is a DataNepal surrogate, not the P-code. See macros/place_id.sql.

  2. `parent_place_id` is an explicit key, not a P-code substring. Substring
     nesting is a genuine property of P-codes and works for the administrative
     hierarchy -- but it cannot express an electoral constituency (which does not
     nest under a single local unit), a protected area (which spans districts),
     or a historical unit that was merged. Encoding the hierarchy as data rather
     than as string arithmetic is what keeps those representable.

  3. `valid_from` / `valid_to` are populated, and places that no longer exist
     stay here rather than disappearing. See docs/adr/0008. Validity defaults
     come from `place_validity` keyed on place_type, because they are facts with
     citations rather than constants; historical places carry their own dates
     from `historical_places` and are deliberately *not* coalesced against the
     defaults, or old Nawalparasi would inherit the 2015 date that abolished it.

  `superseded_by_place_id` is not set here. It is derived in the `places` mart
  from `int_place_successions`, which depends on this model -- computing it here
  would be a cycle. The edge table is authoritative either way.
*/

with units as (
    select * from {{ ref('stg_hdx__admin_units') }}
),

overrides as (
    select id_system, id_value, place_id from {{ ref('place_id_overrides') }}
),

-- Country: not in the COD admin1-3 sheets, so declared here.
country as (
    select
        'country'                                        as place_type,
        'NP'                                             as source_pcode,
        cast(null as varchar)                            as parent_pcode,
        'Nepal'                                          as name_en,
        'नेपाल'                                           as name_ne_seed,
        0                                                as admin_level,
        cast(null as double)                             as area_sqkm,
        cast(null as double)                             as center_lat,
        cast(null as double)                             as center_lon
),

provinces as (
    select
        'province'          as place_type,
        u.pcode             as source_pcode,
        'NP'                as parent_pcode,
        u.name_en,
        p.province_name_ne  as name_ne_seed,
        1                   as admin_level,
        u.area_sqkm, u.center_lat, u.center_lon
    from units u
    left join {{ ref('np_provinces') }} p
        on cast(substr(u.pcode, 3, 2) as integer) = p.province_id
    where u.admin_level = 1
),

districts as (
    select
        'district'            as place_type,
        u.pcode               as source_pcode,
        u.parent_pcode,
        u.name_en,
        cast(null as varchar) as name_ne_seed,
        2                     as admin_level,
        u.area_sqkm, u.center_lat, u.center_lon
    from units u
    where u.admin_level = 2
),

local_units as (
    select
        -- The P-code type digit is authoritative for local unit type. Matching
        -- on Nepali name suffixes misclassifies silently, because the labels
        -- nest as substrings.
        u.unit_type           as place_type,
        u.pcode               as source_pcode,
        u.parent_pcode,
        u.name_en,
        n.name_ne             as name_ne_seed,
        3                     as admin_level,
        u.area_sqkm, u.center_lat, u.center_lon
    from units u
    left join {{ ref('int_place_names_raw') }} n on u.pcode = n.source_pcode
    where u.admin_level = 3
      and not u.is_protected_area
),

protected as (
    select
        'protected_area'      as place_type,
        u.pcode               as source_pcode,
        u.parent_pcode,
        u.name_en,
        cast(null as varchar) as name_ne_seed,
        cast(null as integer) as admin_level,
        u.area_sqkm, u.center_lat, u.center_lon
    from units u
    where u.admin_level = 3 and u.is_protected_area
),

all_places as (
    select * from country
    union all select * from provinces
    union all select * from districts
    union all select * from local_units
    union all select * from protected
),

/*
  Identity is derived from `identity_value`, which is the P-code for a current
  place and the seeded `historical_id` for a place that no longer exists. For
  current places this is byte-identical to the previous expression, so existing
  place_ids are unchanged -- which matters, because every observation
  references them.
*/
current_places as (
    select
        a.*,
        a.source_pcode        as identity_value,
        false                 as is_historical,
        cast(null as date)    as seed_valid_from,
        cast(null as date)    as seed_valid_to
    from all_places a
),

/*
  Places that no longer exist. Seeded rather than derived: the COD publishes
  current geography only, so there is no source to read these from.
*/
historical as (
    select
        h.place_type,
        cast(null as varchar) as source_pcode,
        -- Pre-federal districts nested under zones and development regions,
        -- which this platform does not model. NULL rather than a current
        -- province: old Nawalparasi spanned two of them.
        cast(null as varchar) as parent_pcode,
        h.name_en,
        h.name_ne             as name_ne_seed,
        h.admin_level,
        cast(null as double)  as area_sqkm,
        cast(null as double)  as center_lat,
        cast(null as double)  as center_lon,
        h.historical_id       as identity_value,
        true                  as is_historical,
        h.valid_from          as seed_valid_from,
        h.valid_to            as seed_valid_to
    from {{ ref('historical_places') }} h
),

combined as (
    select * from current_places
    union all by name
    select * from historical
),

with_ids as (
    select
        coalesce(o.place_id, {{ derive_place_id('a.place_type', 'a.identity_value') }})
                                  as place_id,
        a.*
    from combined a
    left join overrides o
        on o.id_system = 'ocha_pcode' and o.id_value = a.source_pcode
),

parents as (
    select source_pcode, place_id from with_ids where source_pcode is not null
),

validity as (
    select place_type, valid_from, valid_to from {{ ref('place_validity') }}
)

select
    w.place_id,
    w.place_type,
    w.admin_level,
    w.name_en,
    w.name_ne_seed                     as name_ne,
    w.source_pcode,

    -- Explicit parent key. Protected areas parent to the district they are
    -- listed under, which is a containment relationship rather than an
    -- administrative one; consumers should filter on place_type.
    p.place_id                         as parent_place_id,

    w.area_sqkm,
    w.center_lat,
    w.center_lon,

    -- Historical places carry their own dates and are not defaulted. A
    -- coalesce here would give an abolished district the valid_from of the
    -- instrument that abolished it.
    case when w.is_historical then w.seed_valid_from else v.valid_from end
                                       as valid_from,
    case when w.is_historical then w.seed_valid_to   else v.valid_to   end
                                       as valid_to,
    w.is_historical,

    -- Historical places come from the seed, not the COD, and must say so:
    -- the licence of a published table is computed from the dataset_ids its
    -- rows carry.
    case when w.is_historical then 'datanepal-internal' else 'cod-ab-npl' end
                                       as dataset_id

from with_ids w
left join parents p  on w.parent_pcode = p.source_pcode
left join validity v on w.place_type = v.place_type
