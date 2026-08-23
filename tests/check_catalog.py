"""Validate every dataset catalog entry against the JSON schema.

Run standalone (`python -m tests.check_catalog`) or via pytest. Kept out of the
dbt test suite because it validates metadata files, not warehouse contents, and
should pass before anything has been built.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "catalog" / "dataset.schema.json"
DATASETS_DIR = ROOT / "catalog" / "datasets"


def validate_all() -> list[str]:
    """Return a list of human-readable errors; empty means everything passed."""
    schema = json.loads(SCHEMA_PATH.read_text())
    validator = Draft202012Validator(schema)
    errors: list[str] = []

    entries = sorted(DATASETS_DIR.glob("*.yml"))
    if not entries:
        return ["No catalog entries found in catalog/datasets/"]

    seen_tables: dict[str, str] = {}
    for path in entries:
        try:
            entry = yaml.safe_load(path.read_text())
        except yaml.YAMLError as exc:
            errors.append(f"{path.name}: invalid YAML: {exc}")
            continue

        for error in sorted(validator.iter_errors(entry), key=lambda e: e.path):
            location = ".".join(str(p) for p in error.path) or "(root)"
            errors.append(f"{path.name}: {location}: {error.message}")

        table = (entry or {}).get("table")
        if table:
            if table in seen_tables:
                errors.append(
                    f"{path.name}: duplicate table '{table}', already declared "
                    f"in {seen_tables[table]}"
                )
            seen_tables[table] = path.name

            # The filename should match the table so the mapping stays obvious.
            if path.stem != table:
                errors.append(
                    f"{path.name}: filename does not match table '{table}'; "
                    f"rename to {table}.yml"
                )

    return errors


def test_catalog_entries_are_valid() -> None:
    """pytest entrypoint."""
    errors = validate_all()
    assert not errors, "Catalog validation failed:\n" + "\n".join(errors)


def main() -> int:
    errors = validate_all()
    if errors:
        print("Catalog validation FAILED:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("Catalog validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
