import Link from "next/link";

/*
  Global header.

  The bilingual lockup is the brand decision: "DataNepal" and "तथ्याङ्क नेपाल"
  sit on one baseline separated by a hairline rule, at comparable optical
  weight. Devanagari is set one step larger than the Latin because its x-height
  is smaller — equal point size does not read as equal. This is deliberately
  not a wordmark with a grey translation underneath it.

  तथ्याङ्क नेपाल means "Statistics Nepal": native vocabulary, institutional
  register, not a transliteration of an English name.

  Navigation is four items and links only to pages that exist. A nav entry
  pointing at an unbuilt Compare page or a non-functional search box is a dead
  experience, which is worse than an absence. Search and language switching go
  in when they work, not as affordances.
*/

const NAV = [
  { href: "/topics/", label: "Topics" },
  { href: "/places/", label: "Places" },
  { href: "/indicators/", label: "Indicators" },
  { href: "/datasets/", label: "Datasets" },
  { href: "/about/", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="border-line bg-surface/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="max-w-page mx-auto flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3.5 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2.5 no-underline">
          <span className="text-ink text-[17px] font-semibold tracking-[-0.02em]">
            DataNepal
          </span>
          <span aria-hidden className="bg-line-strong h-4 w-px self-center" />
          <span className="text-ink-soft group-hover:text-ink text-[18px] font-medium">
            तथ्याङ्क नेपाल
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px]">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-ink-soft hover:text-ink no-underline hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-line mt-16 border-t">
      <div className="max-w-page mx-auto px-5 py-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-ink text-[15px] font-semibold">DataNepal</span>
              <span className="text-ink-soft text-[15px]">तथ्याङ्क नेपाल</span>
            </div>
            <p className="text-ink-faint mt-2 max-w-xs text-[13px]">
              Open, documented public data for Nepal. Aggregates only — this platform
              does not publish personal data.
            </p>
          </div>

          <div>
            <h2 className="text-label text-ink-faint mb-2 uppercase">Explore</h2>
            <ul className="space-y-1 text-[13px]">
              <li>
                <Link href="/topics/">Topics</Link>
              </li>
              <li>
                <Link href="/places/">Places</Link>
              </li>
              <li>
                <Link href="/indicators/">Indicators</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-label text-ink-faint mb-2 uppercase">Data</h2>
            <ul className="space-y-1 text-[13px]">
              <li>
                <Link href="/datasets/">Dataset catalogue</Link>
              </li>
              <li>
                <a href="/data/manifest.json" download>
                  manifest.json
                </a>
              </li>
              <li>
                <a href="/data/observations.parquet" download>
                  All observations
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-label text-ink-faint mb-2 uppercase">About</h2>
            <ul className="space-y-1 text-[13px]">
              <li>
                <Link href="/about/">About DataNepal</Link>
              </li>
              <li>
                <a
                  href="https://github.com/RDhamala/datanepal"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Source code
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="border-line text-ink-faint mt-8 border-t pt-6 text-[12px]">
          Code is MIT-licensed. Each dataset carries its own licence and attribution,
          listed on every page that uses it and in the dataset catalogue.
        </p>
      </div>
    </footer>
  );
}
