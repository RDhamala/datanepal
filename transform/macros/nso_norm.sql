{#
  Fold a place name for matching: case, punctuation and spacing only.

  Deliberately weak. It does NOT transliterate, do edit distance, or strip
  meaningful words. Nepali romanisation is not standardised, so a matcher clever
  enough to bridge Kedarseu and Kedarsyun is also clever enough to attach the
  wrong village's census figures to a place -- silently, in a reference dataset
  other people build on. Anything this cannot resolve is meant to fail loudly and
  be handled by an explicit, reviewed crosswalk row instead.
#}
{% macro nso_norm(column) %}
    regexp_replace(lower(strip_accents(cast({{ column }} as varchar))), '[^a-z0-9]', '', 'g')
{% endmacro %}
