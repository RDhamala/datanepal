.PHONY: help setup catalog ingest build revisions publish check lint clean all

DBT := cd transform && ../.venv/bin/dbt
PY  := .venv/bin/python

help:
	@echo "setup      Install dependencies and dbt packages"
	@echo "catalog    Project catalog YAML into dbt seeds"
	@echo "ingest     Run all source connectors into the warehouse"
	@echo "build      dbt seed + run + test"
	@echo "revisions  Fold the current build into revision history"
	@echo "publish    Export published tables to publish/dist"
	@echo "all        catalog -> ingest -> build -> revisions -> publish"
	@echo "check      Lint and test both sides"
	@echo "clean      Remove the warehouse, dbt target, and published output"

setup:
	uv venv .venv --python 3.12
	uv pip install -e ".[dev]"
	$(DBT) deps

# Provenance has one source of truth: catalog/. This projects it into seeds so
# dbt can join against it. Must run before build.
catalog:
	$(PY) -m catalog.sync_seeds

ingest:
	$(PY) -m ingestion.run --all

build: catalog
	$(DBT) seed
	$(DBT) run
	$(DBT) test

# Append-only. Never overwrites a prior value; see docs/adr/0004.
revisions:
	$(PY) -m publish.revisions

publish:
	$(PY) -m publish.export

all: catalog ingest build revisions publish

check:
	.venv/bin/ruff check .
	$(PY) -m tests.check_catalog
	$(PY) -m pytest -q
	cd web && npm run check

lint:
	.venv/bin/ruff check .

clean:
	rm -rf warehouse transform/target transform/logs publish/dist web/out web/.next
