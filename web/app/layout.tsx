import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: {
    default: "DataNepal — Nepal, in data",
    template: "%s — DataNepal",
  },
  description:
    "Open, documented public data for Nepal. Population, economy and geography for every province and district, with every figure traceable to its publisher.",
  openGraph: {
    title: "DataNepal",
    description: "Open, documented public data for Nepal.",
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
          className="bg-surface-raised border-line sr-only rounded border px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to content
        </a>

        <SiteHeader />

        <main
          id="main"
          className="max-w-page mx-auto w-full flex-1 px-5 py-10 sm:px-8 sm:py-14"
        >
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
