{{ config(materialized = 'view') }}

/*
  ECN House of Representatives results, 2082 BS (2026). Already long-format
  from the connector, so staging only types and validates.
*/

with source as (
    select * from {{ source('raw_ecn_hor', 'hor_2026') }}
)

select
    result_type,
    party_id,
    party_name_ne,
    cast(value as double) as value
from source
where value is not null
