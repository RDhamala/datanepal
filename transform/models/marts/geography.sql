{{ config(materialized = 'table') }}

/*
  Published administrative geography: Nepal's 753 local units with their
  district and province lineage, keyed by OCHA P-code.

  Published standalone because the join key itself is valuable -- other Nepal
  data projects need a canonical geography table and there isn't a good public
  one. See catalog/datasets/geography.yml for provenance.
*/

select
    palika_pcode,
    palika_name_en,
    palika_type,

    district_pcode,
    district_name_en,

    province_pcode,
    province_id,
    province_iso_code,
    province_name_en,
    province_name_ne,

    area_sqkm,
    center_lat,
    center_lon

from {{ ref('int_geography') }}
order by palika_pcode
