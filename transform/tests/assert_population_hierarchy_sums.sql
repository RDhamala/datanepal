{{ config(severity = 'error', error_if = '>0') }}

/*
  Every admin level's population must sum to the national total for the same
  year, sex, and age band.

  This is the cheapest test that catches the failure mode this platform is most
  exposed to: a partial load. Dropping a province raises no error and produces
  no obviously wrong row count -- the national page just quietly under-reports,
  and so does every per-capita figure derived from it. Cross-level
  reconciliation catches it immediately.

  It is also a genuine source check: if UNFPA's district file ever disagrees
  with its national file, we should know before republishing either.
*/

with national as (
    select period, sex, age_band, value as national_value
    from {{ ref('observations') }}
    where indicator_code = 'population'
      and admin_level = 0
),

by_level as (
    select admin_level, period, sex, age_band, sum(value) as level_total
    from {{ ref('observations') }}
    where indicator_code = 'population'
      and admin_level > 0
    group by admin_level, period, sex, age_band
)

select
    b.admin_level,
    b.period,
    b.sex,
    b.age_band,
    n.national_value,
    b.level_total,
    b.level_total - n.national_value as difference
from by_level b
inner join national n
    on b.period = n.period
   and b.sex = n.sex
   and b.age_band = n.age_band
where b.level_total <> n.national_value
