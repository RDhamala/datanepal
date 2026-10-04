/*
  Every exclusion still matches something.

  nso_name_exclusions.csv drops four NSO names for a named defect. If NSO fixes
  one -- or renames the key -- the row stops matching and quietly becomes dead
  weight, and the next person reads it as a current fact about the source.

  A failure here is good news: it means a defect may have been repaired
  upstream and the exclusion can go.
*/

select
    e.name_en,
    'exclusion no longer matches any NSO name' as failure
from {{ ref('nso_name_exclusions') }} e
left join {{ ref('stg_nso__local_unit_names') }} n
    on regexp_replace(lower(e.name_en), '[^a-z]', '', 'g')
     = regexp_replace(lower(n.name_en), '[^a-z]', '', 'g')
where n.name_en is null
