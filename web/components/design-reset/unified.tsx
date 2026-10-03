import Link from "next/link";
import { EscapeSiteChrome, SkipLink } from "./shared";
import { ROLE } from "@/components/editorial/system";

/*
  Unified direction: Direction A's visual system, Direction B's geography.

  A owns identity, type, rhythm and tone. B contributes only behaviour -- the
  linked map and ranking -- restyled to read as an editorial figure rather than
  a dashboard panel.
*/

/* ------------------------------------------------------------------ shell */

export function UnifiedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface min-h-screen">
      <EscapeSiteChrome />
      <SkipLink />
      <header className="border-line border-b">
        <div className="max-w-page mx-auto flex flex-wrap items-baseline gap-x-8 gap-y-2 px-5 py-5 sm:px-8">
          <Link href="/design-reset/unified/home/" className="no-underline">
            <span
              className="text-ink text-[22px] leading-none font-semibold tracking-[-0.02em]"
              style={ROLE.masthead}
            >
              DataNepal
            </span>
            <span className="text-ink-faint ne ml-2 text-[15px]" lang="ne">
              तथ्याङ्क नेपाल
            </span>
          </Link>
          <nav
            aria-label="Sections"
            className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]"
          >
            {[
              ["Places", "/places/"],
              ["Indicators", "/indicators/"],
              ["Compare", "/compare/"],
              ["Datasets", "/datasets/"],
              ["About", "/about/"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="text-ink-soft no-underline hover:underline"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="proto-main">{children}</main>
      <UnifiedFooter />
    </div>
  );
}

function UnifiedFooter() {
  return (
    <footer className="border-line text-ink-faint mt-20 border-t">
      <div className="max-w-page mx-auto grid gap-8 px-5 py-10 text-[12px] sm:grid-cols-4 sm:px-8">
        <div className="sm:col-span-2">
          <p className="text-ink text-[17px] font-semibold" style={ROLE.masthead}>
            DataNepal
            <span className="text-ink-faint ne ml-2 text-[13px] font-normal" lang="ne">
              तथ्याङ्क नेपाल
            </span>
          </p>
          <p className="mt-2 max-w-sm leading-relaxed">
            Open, documented public data for Nepal. Aggregates only — this platform does
            not publish personal data.
          </p>
        </div>
        <div>
          <p className="text-ink mb-2 font-medium">Explore</p>
          <ul className="space-y-1">
            <li>
              <Link href="/places/">Places</Link>
            </li>
            <li>
              <Link href="/indicators/">Indicators</Link>
            </li>
            <li>
              <Link href="/compare/">Compare</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-ink mb-2 font-medium">Data</p>
          <ul className="space-y-1">
            <li>
              <Link href="/datasets/">Datasets and downloads</Link>
            </li>
            <li>
              <Link href="/about/">Methodology</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export {
  BenchmarkLine,
  Figure,
  LeadStat,
  ROLE,
  Section,
  SERIF,
  StatRow,
} from "@/components/editorial/system";
