# Architecture Decision Records

One record per decision that would be expensive to reverse. Used selectively:
routine choices belong in code comments, not here.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-static-first-deployment.md) | Static-first deployment, no application server | Accepted |
| [0002](0002-canonical-geography-identity.md) | Canonical place identity is a DataNepal surrogate, not a P-code | Accepted |
| [0003](0003-canonical-observation-model.md) | One observation model with extensible dimensions | Accepted |
| [0004](0004-revision-history.md) | Append-only revision history in a committed file | Accepted |
| [0005](0005-duckdb-as-warehouse.md) | DuckDB as the analytical warehouse | Accepted |
| [0006](0006-provenance-enforcement.md) | Provenance enforced at the publication boundary | Accepted |
| [0007](0007-licensing-boundaries.md) | Licence computed per table; share-alike is a tested boundary | Accepted |
