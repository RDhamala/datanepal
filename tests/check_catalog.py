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
SOURCE_SCHEMA = ROOT / "catalog" / "source.schema.json"
TABLE_SCHEMA = ROOT / "catalog" / "table.schema.json"
SOURCES_DIR = ROOT / "catalog" / "sources"
TABLES_DIR = ROOT / "catalog" / "tables"


def _validate_dir(
    directory: Path, schema_path: Path, key: str
) -> tuple[list[str], set[str]]:
    """Validate every YAML file in a directory. Returns (errors, seen keys)."""
    validator = Draft202012Validator(json.loads(schema_path.read_text()))
    errors: list[str] = []
    seen: dict[str, str] = {}

    paths = sorted(directory.glob("*.yml"))
    if not paths:
        return [f"No entries found in {directory.name}/"], set()

    for path in paths:
        try:
            entry = yaml.safe_load(path.read_text())
        except yaml.YAMLError as exc:
            errors.append(f"{path.name}: invalid YAML: {exc}")
            continue

        for error in sorted(validator.iter_errors(entry), key=lambda e: e.path):
            location = ".".join(str(p) for p in error.path) or "(root)"
            errors.append(f"{path.name}: {location}: {error.message}")

        value = (entry or {}).get(key)
        if not value:
            errors.append(f"{path.name}: missing '{key}'")
            continue
        if value in seen:
            errors.append(
                f"{path.name}: duplicate {key} '{value}', already in {seen[value]}"
            )
        seen[value] = path.name

        # Filename must match the key, so the mapping stays obvious on disk.
        if path.stem != value:
            errors.append(
                f"{path.name}: filename does not match {key} '{value}'; "
                f"rename to {value}.yml"
            )

    return errors, set(seen)


def validate_all() -> list[str]:
    """Return a list of human-readable errors; empty means everything passed."""
    source_errors, source_ids = _validate_dir(SOURCES_DIR, SOURCE_SCHEMA, "dataset_id")
    table_errors, _ = _validate_dir(TABLES_DIR, TABLE_SCHEMA, "table")
    errors = source_errors + table_errors

    # Every source a table claims must exist. A table citing a source that was
    # never documented would publish with an unresolvable licence.
    known = source_ids | {"datanepal-internal"}
    for path in sorted(TABLES_DIR.glob("*.yml")):
        try:
            entry = yaml.safe_load(path.read_text()) or {}
        except yaml.YAMLError:
            continue
        for sid in entry.get("sources", []):
            if sid not in known:
                errors.append(
                    f"{path.name}: source '{sid}' has no entry in catalog/sources/"
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
