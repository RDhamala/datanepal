.PHONY: help setup ingest build test publish catalog-check lint clean all

DBT := cd transform && ../.venv/bin/dbt
PY  := .venv/bin/python

help:
	@echo "setup          Install dependencies and dbt packages"
	@echo "ingest         Run all source connectors into the warehouse"
	@echo "build          Run dbt: seeds, models, tests"
	@echo "test           Run dbt tests and catalog validation"
	@echo "publish        Export marts to static Parquet/JSON in publish/dist"
	@echo "all            ingest -> build -> publish"
	@echo "lint           Ruff check"
	@echo "clean          Remove warehouse, dbt target, and published output"

setup:
	uv venv .venv
	uv pip install -e ".[dev]"
	$(DBT) deps

ingest:
	$(PY) -m ingestion.run --all

build:
	$(DBT) seed
	$(DBT) run
	$(DBT) test

test: catalog-check
	$(DBT) test

catalog-check:
	$(PY) -m tests.check_catalog

publish:
	$(PY) -m publish.export

all: ingest build publish

lint:
	.venv/bin/ruff check .

clean:
	rm -rf warehouse transform/target transform/logs publish/dist
