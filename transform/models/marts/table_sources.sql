{{ config(materialized = 'table') }}

/*
  Which source datasets each published table draws on.

  Published so licence derivation is auditable as data: a consumer can verify
  for themselves why a table carries the terms it does, rather than trusting our
  summary of it.
*/

select table_name, dataset_id from {{ ref('table_sources') }}
order by table_name, dataset_id
