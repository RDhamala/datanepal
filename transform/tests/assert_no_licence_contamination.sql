{{ config(severity = 'error', error_if = '>0') }}

/*
  A published table may not understate the obligations of its inputs.

  Share-alike licences (ODbL, CC BY-SA) propagate to derived databases. If a
  share-alike source ever feeds a table, that table's effective licence must be
  share-alike too -- and anyone downstream needs to know, because the obligation
  travels with the data whether or not we mention it.

  This is why licence lives on the *source dataset* and share_alike is a boolean
  rather than prose. A licensing question that can be decided by a join is a
  question that gets decided correctly every build, instead of once during a
  conversation somebody later forgets.

  Currently no share-alike source is in use: OpenStreetMap was rejected as a
  name source on exactly these grounds, in favour of CC0 Wikidata. This test is
  the guard that keeps that decision from being quietly undone.
*/

with table_sources as (
    select table_name, dataset_id from {{ ref('table_sources') }}
),

with_licences as (
    select
        ts.table_name,
        ts.dataset_id,
        d.licence_id,
        l.share_alike,
        l.commercial_ok,
        l.redistribution_ok
    from table_sources ts
    join {{ ref('datasets') }} d on ts.dataset_id = d.dataset_id
    join {{ ref('licences') }} l on d.licence_id = l.licence_id
),

per_table as (
    select
        table_name,
        max(case when share_alike then 1 else 0 end)       as any_share_alike,
        min(case when redistribution_ok then 1 else 0 end) as all_redistributable,
        string_agg(distinct licence_id, ', ')              as licences
    from with_licences
    group by table_name
)

select
    table_name,
    licences,
    any_share_alike,
    all_redistributable,
    case
        when any_share_alike = 1 then
            'a share-alike source feeds this table; its effective licence must be share-alike'
        else
            'a source forbids redistribution; this table must not be published'
    end as problem
from per_table
where any_share_alike = 1
   or all_redistributable = 0
