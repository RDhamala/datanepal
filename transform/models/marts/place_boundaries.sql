{{ config(materialized = 'table') }}

/*
  Published boundary geometry, joined to canonical place ids.

  Geometry is a GeoJSON MultiPolygon string rather than a typed spatial column:
  every consumer wants GeoJSON, DuckDB's spatial extension is an optional
  download that fails behind a TLS-inspecting proxy, and a nested coordinate
  array is awkward to carry through Parquet into JavaScript. A string is the
  format that works everywhere.

  Coordinates are lon/lat. Projection is the consumer's decision.
*/

select
    p.place_id,
    b.admin_level,
    p.place_type,
    p.name_en,
    p.name_ne,
    p.slug,
    p.parent_place_id,
    b.source_pcode        as ocha_pcode,
    b.geometry_geojson,
    'cod-ab-npl'          as dataset_id
from {{ ref('stg_hdx__boundaries') }} b
inner join {{ ref('int_place_identifiers') }} pi
    on pi.id_system = 'ocha_pcode' and pi.id_value = b.source_pcode
inner join {{ ref('places') }} p on p.place_id = pi.place_id
-- Current only. Historical places have no P-code today, so this changes
-- nothing yet -- but the realistic next case is a unit that OCHA merges, which
-- *would* carry the old P-code and would otherwise draw a stale polygon on
-- every map. See ADR-0008.
where p.is_current
order by b.admin_level, b.source_pcode
