{{ config(materialized = 'view') }}

/*
  Simplified boundary geometry from the OCHA COD, keyed by P-code.

  Geometry arrives already simplified from ingestion -- see
  ingestion/sources/hdx_boundaries.py for why that happens there rather than
  here or in the browser.
*/

select
    trim(pcode)                   as source_pcode,
    cast(admin_level as integer)  as admin_level,
    trim(name_en)                 as name_en,
    geometry                      as geometry_geojson
from {{ source('raw_hdx_boundaries', 'boundaries') }}
where pcode is not null
  and geometry is not null
