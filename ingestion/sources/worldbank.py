"""World Bank World Development Indicators — Nepal.

Source: https://api.worldbank.org/v2
Licence: CC BY 4.0 (https://datacatalog.worldbank.org/public-licenses)

This exists as an architecture test rather than for content: it is structurally
unlike census population in every way that matters.

  - National only. No subnational join, no crosswalk.
  - A time series, ~60 annual observations per indicator rather than one year.
  - Mixed units: a percentage, a per-capita currency amount, an absolute
    currency amount. The previous schema had a single `unit` string and no
    currency concept at all.
  - No dimensions. Under the old schema every row would have carried
    meaningless nulls in `sex` and `age_band`.
  - Revised in place. The API reports `lastupdated` per indicator, which is
    recorded as the publication date so a restated figure is distinguishable
    from a new one.
  - Rates that must never be summed. `is_additive` on the indicator carries
    that, because a reader who averages inflation across provinces gets a
    number that looks fine and is wrong.

The World Bank is an aggregator here, not the primary collector: these series
are compiled from Nepal Rastra Bank and the National Statistics Office. That is
recorded in the source catalog so attribution is not misleading.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from typing import Any

import dlt
import httpx

logger = logging.getLogger(__name__)

API = "https://api.worldbank.org/v2"
COUNTRY = "NPL"

# Indicator code -> (our indicator_id, unit_id). Deliberately small: the point
# is to exercise the model, not to mirror the WDI catalogue.
INDICATORS: dict[str, tuple[str, str]] = {
    "FP.CPI.TOTL.ZG": ("cpi_inflation_annual", "percent"),
    "NY.GDP.PCAP.CD": ("gdp_per_capita_usd", "usd_current"),
    "BX.TRF.PWKR.CD.DT": ("remittances_received_usd", "usd_current"),
    "BX.TRF.PWKR.DT.GD.ZS": ("remittances_percent_gdp", "percent_gdp"),
    # Health topic's first indicators -- WHO/UNICEF-compiled, same aggregator,
    # same licence, same national-only shape as the economy series above.
    "SP.DYN.LE00.IN": ("life_expectancy_at_birth", "years"),
    "SH.DYN.MORT": ("under5_mortality_rate", "per_1000_live_births"),
    "SH.STA.MMRT": ("maternal_mortality_ratio", "per_100000_live_births"),
    "SH.IMM.IDPT": ("immunization_dpt_rate", "percent"),
    # Agriculture topic's first indicators -- FAO-compiled, same aggregator
    # pattern again.
    "NV.AGR.TOTL.ZS": ("agriculture_value_added_pct_gdp", "percent_gdp"),
    "AG.LND.AGRI.ZS": ("agricultural_land_pct", "percent"),
    "AG.YLD.CREL.KG": ("cereal_yield_kg_per_ha", "kg_per_hectare"),
    "AG.PRD.FOOD.XD": ("food_production_index", "index"),
    # Infrastructure topic's first indicators -- IEA/ITU-compiled access
    # measures, same aggregator pattern again.
    "EG.ELC.ACCS.ZS": ("electricity_access_pct", "percent"),
    "IT.NET.USER.ZS": ("internet_users_pct", "percent"),
    "IT.CEL.SETS.P2": ("mobile_subscriptions_per100", "per_100_people"),
    "EG.CFT.ACCS.ZS": ("clean_cooking_fuel_access_pct", "percent"),
}

# The API is generous but paginated; one page per indicator is plenty for a
# single country's annual series.
PER_PAGE = 500


def _verify() -> str | bool:
    """Honour conventional CA env vars; httpx ignores them by default."""
    for var in ("REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"):
        path = os.getenv(var)
        if path and os.path.exists(path):
            return path
    return True


@dlt.resource(name="indicators", write_disposition="replace")
def indicators() -> Iterator[dict[str, Any]]:
    """Yield one row per indicator-year."""
    emitted = 0
    with httpx.Client(timeout=60, follow_redirects=True, verify=_verify()) as client:
        for wb_code, (indicator_id, unit_id) in INDICATORS.items():
            response = client.get(
                f"{API}/country/{COUNTRY}/indicator/{wb_code}",
                params={"format": "json", "per_page": PER_PAGE},
                headers={
                    "User-Agent": "datanepal-bot/0.1 "
                    "(+https://github.com/RDhamala/datanepal)"
                },
            )
            response.raise_for_status()
            payload = response.json()

            # The API returns [metadata, rows]. An error returns a single dict.
            if not isinstance(payload, list) or len(payload) < 2:
                raise ValueError(f"Unexpected response shape for {wb_code}: {payload!r}")
            meta, rows = payload[0], payload[1] or []

            # Publication date of this indicator's current vintage. This is what
            # makes revisions detectable: the same year can be republished with a
            # different value and a later lastupdated.
            published_at = meta.get("lastupdated")

            kept = 0
            for row in rows:
                value = row.get("value")
                # A null value means the World Bank has no figure for that year.
                # Emitting it with status 'not_collected' is more honest than
                # dropping the row, because a gap in a time series is
                # information -- but it would triple the row count for little
                # gain, so gaps are simply absent and the frontend must not
                # assume a contiguous series.
                if value is None:
                    continue
                year = row.get("date")
                if not year or not str(year).isdigit():
                    continue

                # obs_status carries the publisher's own qualification when set.
                obs_status = (row.get("obs_status") or "").strip().lower()
                status = {
                    "": "actual",
                    "e": "estimate",
                    "p": "provisional",
                    "f": "forecast",
                }.get(obs_status, "actual")

                kept += 1
                emitted += 1
                yield {
                    "country_code": "NP",
                    "indicator_id": indicator_id,
                    "worldbank_code": wb_code,
                    "year": int(year),
                    "value": float(value),
                    "unit_id": unit_id,
                    "status": status,
                    "published_at": published_at,
                }

            logger.info("%s -> %s: %d observations", wb_code, indicator_id, kept)

    if emitted < 100:
        # Four indicators across six decades should comfortably exceed this. A
        # short read means a truncated response or a renamed indicator code,
        # both of which would otherwise pass silently.
        raise ValueError(
            f"Only {emitted} observations across {len(INDICATORS)} indicators; "
            "expected several hundred. Check for renamed indicator codes."
        )


@dlt.source(name="worldbank")
def worldbank_source():
    return [indicators()]
