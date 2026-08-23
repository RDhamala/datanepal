import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DataNepal — Nepal, in data",
    template: "%s — DataNepal",
  },
  description:
    "Open, documented data on every province and district in Nepal. Population, geography, and more — every figure traceable to its source.",
  openGraph: {
    title: "DataNepal",
    description: "Open, documented data on every province and district in Nepal.",
    url: "https://datanepal.org",
    siteName: "DataNepal",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="bg-surface-raised border-line focus:ring-series-1 sr-only rounded border px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to content
        </a>

        <header className="border-line bg-surface-raised/80 sticky top-0 z-40 border-b backdrop-blur">
          <div className="max-w-page mx-auto flex items-baseline gap-3 px-5 py-3">
            <Link href="/" className="text-ink text-[15px] font-semibold no-underline">
              DataNepal
            </Link>
            <span className="text-ink-faint text-[13px]">नेपाल, तथ्याङ्कमा</span>
          </div>
        </header>

        <main id="main" className="max-w-page mx-auto w-full flex-1 px-5 py-10">
          {children}
        </main>

        <footer className="border-line mt-8 border-t">
          <div className="text-ink-faint max-w-page mx-auto px-5 py-8 text-[13px]">
            <p className="max-w-2xl">
              Open data on Nepal. Aggregates only — this platform does not publish
              personal data. Code is MIT-licensed; each dataset carries its own licence,
              listed on every page that uses it.
            </p>
            <p className="mt-3">
              <a
                href="https://github.com/RDhamala/datanepal"
                rel="noopener noreferrer"
                target="_blank"
              >
                Source on GitHub
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
