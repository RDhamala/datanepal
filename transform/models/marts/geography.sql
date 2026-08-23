{{ config(materialized = 'table') }}

/*
  Published administrative geography.

  Thin over int_geography by design: marts are the public contract, and keeping
  them separate from intermediate models means the spine can be refactored
  without changing what consumers see.

  Exported to static Parquet and JSON by publish/export.py, and documented in
  catalog/datasets/geography.yml.
*/

select
    palika_id,
    palika_name_ne,
    palika_type,

    district_id,
    district_name_ne,

    province_id,
    province_code,
    province_name_en,
    province_name_ne

from {{ ref('int_geography') }}
order by province_id, district_id, palika_id
