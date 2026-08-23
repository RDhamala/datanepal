import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DataNepal — Nepal, in data",
    template: "%s — DataNepal",
  },
  description:
    "Open, documented data on every province, district, and local unit in Nepal.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="masthead">
          <div className="wrap">
            <strong>
              <Link href="/" style={{ color: "var(--text-primary)" }}>
                DataNepal
              </Link>
            </strong>
            <span>नेपाल, तथ्याङ्कमा</span>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer>
          <div className="wrap">
            Open data on Nepal. Code MIT-licensed; each dataset carries its own
            licence — see the sources listed on any page.{" "}
            <a
              href="https://github.com/RDhamala/datanepal"
              rel="noopener noreferrer"
              target="_blank"
            >
              Source on GitHub
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
