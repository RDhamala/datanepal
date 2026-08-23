{{ config(severity = 'error', error_if = '>0') }}

/*
  Every observation must either carry a value or say why it does not.

  A NULL with status 'suppressed' or 'not_collected' is information: the figure
  exists but is withheld for confidentiality, or was never gathered. A NULL with
  status 'actual' is a bug that will render as a blank cell and be read as zero.

  The converse also matters: a suppressed observation must not carry a value,
  or the suppression is cosmetic.
*/

select
    observation_id,
    indicator_id,
    status,
    value_numeric,
    value_text,
    case
        when value_numeric is null and value_text is null
            then 'no value, and status does not explain the absence'
        else 'status claims the value is withheld, but a value is present'
    end as problem
from {{ ref('observations') }}
where (
        value_numeric is null
    and value_text is null
    and status not in ('suppressed', 'not_collected')
)
or (
        status in ('suppressed', 'not_collected')
    and (value_numeric is not null or value_text is not null)
)
