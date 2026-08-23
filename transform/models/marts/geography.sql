{{ config(materialized = 'table') }}

/*
  Published administrative geography: Nepal's 753 local units with their
  district and province lineage, keyed by OCHA P-code.

  Nepali names are joined from the int_place_names crosswalk rather than being
  part of the spine itself. That keeps the spine dependent only on the COD --
  the authority for which places exist -- while names, which come from a
  different source with partial coverage, stay a separate concern that can
  improve without touching the geography.

  palika_name_ne is NULL where no verified name exists. Not transliterated:
  a guessed name in a reference dataset is worse than a visible gap.
*/

select
    g.palika_pcode,
    g.palika_name_en,
    n.palika_name_ne,
    g.palika_type,

    g.district_pcode,
    g.district_name_en,

    g.province_pcode,
    g.province_id,
    g.province_iso_code,
    g.province_name_en,
    g.province_name_ne,

    g.area_sqkm,
    g.center_lat,
    g.center_lon,

    -- Provenance for the Nepali name, so consumers can judge it.
    n.wikidata_qid,
    n.match_method as name_match_method

from {{ ref('int_geography') }} g
left join {{ ref('int_place_names') }} n
    on g.palika_pcode = n.palika_pcode
order by g.palika_pcode
