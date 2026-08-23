"""Election Commission of Nepal — voter roll aggregates.

Source: https://voterlist.election.gov.np

AGGREGATES ONLY. This connector deliberately does not fetch individual voter
records. The source site exposes names, voter ID numbers, and family names
through per-ward lookups; republishing those in bulk is a different act than
publishing counts, and this platform does not do it. If you extend this module,
do not add row-level extraction.

The site is an old PHP application with no API: cascading dropdowns driven by
form posts returning HTML fragments. We walk the hierarchy province -> district
-> palika -> ward and parse the option lists.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import dlt
import httpx
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential

BASE_URL = "https://voterlist.election.gov.np/index_process.php"

# Identify the crawler honestly rather than impersonating a browser. A public
# data project scraping a public registry should be attributable.
HEADERS = {
    "User-Agent": "datanepal-bot/0.1 (+https://github.com/RDhamala/datanepal)",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://voterlist.election.gov.np/",
}

# Government infrastructure, modest capacity. Deliberately slow: a full crawl
# is ~800 requests, which at this rate is under an hour. There is no reason to
# go faster, and good reason not to.
REQUEST_DELAY_SECONDS = 1.5
TIMEOUT_SECONDS = 30


@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=2, min=2, max=30))
def _post(client: httpx.Client, payload: dict[str, Any]) -> str:
    """POST a form step, retrying with backoff on transient failures."""
    response = client.post(BASE_URL, data=payload, headers=HEADERS, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.text


def _parse_options(html: str) -> list[dict[str, str]]:
    """Extract (value, label) pairs from an HTML <option> fragment."""
    soup = BeautifulSoup(html, "html.parser")
    options = []
    for option in soup.find_all("option"):
        value = (option.get("value") or "").strip()
        label = option.get_text(strip=True)
        if value and label:
            options.append({"value": value, "label": label})
    return options


@dlt.resource(name="geography", write_disposition="replace", primary_key="palika_id")
def geography() -> Iterator[dict[str, Any]]:
    """Walk the province -> district -> palika hierarchy.

    Yields one record per local unit. This feeds the geography spine, so
    completeness matters more than speed: a missing palika silently drops every
    downstream statistic for that unit.
    """
    import time

    with httpx.Client(follow_redirects=True) as client:
        for province_id in range(1, 8):
            districts_html = _post(client, {"dataType": "district", "provinceId": province_id})
            time.sleep(REQUEST_DELAY_SECONDS)

            for district in _parse_options(districts_html):
                district_id = int(district["value"])
                palikas_html = _post(
                    client, {"dataType": "vdcmun", "districtId": district_id}
                )
                time.sleep(REQUEST_DELAY_SECONDS)

                for palika in _parse_options(palikas_html):
                    yield {
                        "province_id": province_id,
                        "district_id": district_id,
                        "district_name": district["label"],
                        "palika_id": int(palika["value"]),
                        "palika_name": palika["label"],
                    }


@dlt.source(name="election_commission")
def election_commission_source():
    """dlt source bundling the Election Commission resources."""
    return [geography()]
