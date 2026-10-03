{{ config(severity = 'error', error_if = '>0') }}

/*
  The current spine, counted against the federal structure.

  `assert_geography_completeness` already checks districts and local units per
  province, but it counts through `geography`, which is filtered to
  admin_level 3 lineage. This counts `places` directly and at every level, which
  is what catches the failure that filtering introduced: a *current* place
  wrongly flagged historical, or a historical one wrongly left open.

  Both are invisible to a row-count check on the whole table -- adding two
  historical districts and losing two current ones nets to zero -- which is why
  the expectation is per level and stated as a literal rather than derived from
  the data it is checking.

  22 protected areas: the type-5 P-codes that make the local-unit count 753
  rather than 775.
*/

with expected(place_type_group, expected_n) as (
    values
        ('country', 1),
        ('province', 7),
        ('district', 77),
        ('local_unit', 753),
        ('protected_area', 22)
),

actual as (
    select
        case
            when place_type in ('metropolitan', 'sub_metropolitan',
                                'municipality', 'rural_municipality')
                then 'local_unit'
            else place_type
        end            as place_type_group,
        count(*)       as actual_n
    from {{ ref('places') }}
    where is_current
    group by 1
)

select
    e.place_type_group,
    e.expected_n,
    coalesce(a.actual_n, 0) as actual_n
from expected e
left join actual a on e.place_type_group = a.place_type_group
where coalesce(a.actual_n, 0) <> e.expected_n
