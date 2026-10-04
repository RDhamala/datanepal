/*
  The district crosswalk is 1:1.

  A crosswalk that quietly fans out is a failure this project has already had:
  the Wikidata local-unit crosswalk produced 755 rows for 753 places because
  Wikidata holds several items for some of them. Here the symptom would be a
  district appearing twice in the spine rather than an error.

  Checked in both directions. One Wikidata item claimed by two districts is
  the more dangerous half -- it means a name has been attached to a place it
  does not belong to.
*/

with per_district as (
    select source_pcode as k, count(*) as n, 'district matched more than once' as failure
    from {{ ref('int_district_names') }}
    where name_ne is not null
    group by 1 having count(*) > 1
),

per_item as (
    select wikidata_qid as k, count(*) as n, 'Wikidata item claimed by more than one district' as failure
    from {{ ref('int_district_names') }}
    where wikidata_qid is not null
    group by 1 having count(*) > 1
)

select * from per_district
union all
select * from per_item
