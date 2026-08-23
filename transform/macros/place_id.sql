{#
  Derive a canonical place_id from a source identifier.

  place_id is a DataNepal surrogate, deliberately not a source code. P-codes are
  OCHA's identifiers: excellent, maintained, and still someone else's namespace.
  If OCHA renumbers a unit, or a second source becomes authoritative, the place
  must keep its identity.

  Derived by hash rather than a sequence because the warehouse is rebuilt from
  scratch on every run -- a sequence would assign different ids each build. A
  hash of (place_type, authoritative id) is stable across builds with no
  persistent state.

  The escape hatch is seeds/place_id_overrides.csv: when a source renumbers, pin
  the new identifier to the existing place_id there rather than letting the
  derived value drift. That file is the reason this is a real surrogate and not
  just a P-code in disguise.
#}
{% macro derive_place_id(place_type_col, identifier_col) %}
    'pl_' || substr(md5({{ place_type_col }} || '|' || {{ identifier_col }}), 1, 12)
{% endmacro %}
