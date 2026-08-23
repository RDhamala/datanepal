{{ config(materialized = 'table') }}

-- Published reference table, passed through from the seed so consumers get it
-- alongside the facts rather than having to clone the repo.
select * from {{ ref('units') }}
