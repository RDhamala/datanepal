import Link from "next/link";

export function Crumbs({
  trail,
}: {
  trail: { href?: string; label: string }[];
}) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {trail.map((c, i) => (
        <span key={i}>
          {i > 0 && <span className="sep">›</span>}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/**
 * Provenance block. Present on every page that shows a number.
 *
 * Not decorative: an aggregate with no stated source, licence, or vintage is
 * not citable, and citability is most of what makes a public data platform
 * worth using rather than merely interesting.
 */
export function Sources({
  datasets,
}: {
  datasets: {
    table: string;
    title: string;
    source: { name: string; url: string; accessed?: string } | null;
    licence: string | null;
    vintage: string | null;
    parquet: string | null;
    json: string | null;
  }[];
}) {
  if (!datasets.length) return null;
  return (
    <section>
      <h2>Sources</h2>
      <p className="note">Every figure on this page comes from one of these datasets.</p>
      <ul className="sources">
        {datasets.map((d) => (
          <li key={d.table}>
            <strong>{d.title}</strong>
            {d.vintage && <> · reference period {d.vintage}</>}
            <br />
            {d.source && (
              <>
                {d.source.name} —{" "}
                <a href={d.source.url} rel="noopener noreferrer" target="_blank">
                  source
                </a>
                {d.source.accessed && <> · retrieved {d.source.accessed}</>}
                <br />
              </>
            )}
            <span className="lic">licence: {d.licence ?? "unknown"}</span>
          </li>
        ))}
      </ul>
      <div className="downloads">
        {datasets.map((d) =>
          d.parquet ? (
            <a key={d.parquet} href={`/data/${d.parquet}`} download>
              {d.table}.parquet
            </a>
          ) : null,
        )}
        {datasets.map((d) =>
          d.json ? (
            <a key={d.json} href={`/data/${d.json}`} download>
              {d.table}.json
            </a>
          ) : null,
        )}
      </div>
    </section>
  );
}
