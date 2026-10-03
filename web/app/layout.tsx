import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "DataNepal — Nepal, in data",
    template: "%s — DataNepal",
  },
  description:
    "Open, documented public data for Nepal. Population, economy and geography for every province and district, with every figure traceable to its publisher.",
  openGraph: {
    title: "DataNepal",
    description: "Open, documented public data for Nepal.",
    url: SITE_ORIGIN,
    siteName: "DataNepal",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/*
          The Devanagari subset, preloaded.

          It is the one face a Nepali name needs and the only one on the
          critical path: every page carries bilingual chrome, so waiting for
          the stylesheet to be parsed before the request starts is a visible
          swap. The Latin subsets are not preloaded -- they cover punctuation
          inside Nepali strings and arrive in time.

          Hand-written because the faces are declared in globals.css now
          rather than generated. The generator emitted exactly this link, for
          exactly this file.
        */}
        <link
          rel="preload"
          href="/fonts/noto-sans-devanagari-devanagari.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
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
