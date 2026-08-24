import type { Metadata } from "next";
import { Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

/*
  Self-hosted at build time so every visitor sees the chosen Devanagari face
  rather than whatever their OS happens to substitute. "Noto Sans Devanagari"
  as a bare CSS font-family name only works for the fraction of visitors who
  already have it installed -- most don't, since it isn't a system font on
  Windows or macOS. next/font fetches it once at build time and serves it from
  our own origin, so it renders identically everywhere and needs no runtime
  request to Google.
*/
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-noto-devanagari",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://datanepal.org"),
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
    <html lang="en" className={notoDevanagari.variable}>
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
