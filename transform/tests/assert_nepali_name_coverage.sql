{{ config(severity = 'warn', warn_if = '>0') }}

/*
  Report local units still lacking a verified Nepali name.

  A warning, not an error: partial coverage is the known current state, not a
  regression, and the build should not be red for a gap we have already
  characterised. It exists so the gap stays visible in every run rather than
  becoming something you have to remember to go and check.

  Promote to `error` once coverage reaches 100%, so it then catches regressions.
*/

select
    palika_type,
    count(*) as units_without_nepali_name
from {{ ref('geography') }}
where palika_name_ne is null
group by palika_type
order by units_without_nepali_name desc
