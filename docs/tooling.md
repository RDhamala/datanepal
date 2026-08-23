# Tooling

What is required, what is merely useful, and what is obsolete. Audited during
the architecture validation pass of 2026-08-23.

## Required project dependencies

Declared in `pyproject.toml` and `web/package.json`; CI installs exactly these.

| Tool | Role |
|---|---|
| Python 3.12 | Pipeline runtime. Pinned — 3.14 breaks dbt. |
| uv | Python packaging. Handles the corporate-proxy TLS case via `UV_NATIVE_TLS`. |
| dlt | Ingestion |
| DuckDB | Warehouse engine |
| dbt-core, dbt-duckdb | Transformation, lineage, tests |
| pyarrow, openpyxl, httpx, PyYAML, jsonschema | Format and transport support |
| Node 22 | Frontend build (CI pins 22; 26 works locally) |
| Next.js, React, Tailwind | Site |
| hyparquet | Build-time Parquet reads. Pure JS — no native binding to fail in CI. |

## Developer tooling

Not needed to run the pipeline, but expected in a contributor's environment.

| Tool | Role |
|---|---|
| ruff | Python lint and format |
| pytest | Python tests |
| ESLint, Prettier, TypeScript | Frontend quality |
| Vitest | Frontend tests |
| `gh` CLI | GitHub operations |

## Optional debugging tools

| Tool | When it helps |
|---|---|
| Cloudflare MCP | Inspecting Pages projects, DNS, deployments. Used to diagnose and fix a live routing failure. |
| Chrome DevTools MCP | Actually looking at the rendered site. Screenshots, layout, console. Its absence is why a stylesheet was once written blind. |
| `duckdb` CLI | Poking at the warehouse directly |

## Obsolete

Removed during this pass:

| Tool | Why it is gone |
|---|---|
| DigitalOcean MCP | The droplet was destroyed; the static architecture has no servers. MCP config removed. |
| `doctl` config | No DigitalOcean resources remain except one snapshot. |

## Intentionally left installed

These are system-level software from the earlier server-based architecture. They
are no longer used by this project, and are left in place rather than uninstalled
because removing them affects the machine, not the repository.

| Tool | Note |
|---|---|
| Colima + Docker CLI | Installed for the previous Docker Compose stack. The static architecture has no containers. Colima's VM can be stopped with `colima stop` to reclaim memory. Chose Colima over Docker Desktop deliberately: Desktop requires a paid licence at organisations above 250 staff. |
| `doctl` | Retained to manage the one remaining DigitalOcean snapshot, which holds the predecessor project's data. |
| DigitalOcean snapshot | ~$1.84/month. Holds the original 901 MB voter database. Deleting it is irreversible; keeping it is cheap. |

## Environment notes

Behind a TLS-inspecting corporate proxy:

```bash
export UV_NATIVE_TLS=1                                       # uv, system trust store
export REQUESTS_CA_BUNDLE=~/.certs/corporate-ca-bundle.pem   # dbt deps, connectors
export NODE_EXTRA_CA_CERTS=~/.certs/corporate-ca-bundle.pem  # npm
```

`httpx` ignores the conventional CA variables, so connectors call a local
`_verify()` helper that honours them. Follow that pattern in new connectors.

Outbound SSH to arbitrary hosts is blocked after key exchange on this network,
which is why operational work runs through CI rather than a local shell.
