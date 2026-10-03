/*
  The component laboratory is a development route.

  `noindex` keeps a page out of search results; it does not keep it off the
  CDN. So the gate is the build itself: app/design-lab/page.dev.tsx is only a
  route when `dev.tsx` is in pageExtensions, which happens in `next dev` and
  in a build that asks for it:

      DESIGN_LAB=1 npm run build

  An ordinary production build never compiles it.
*/
const designLab =
  process.env.NODE_ENV !== "production" || process.env.DESIGN_LAB === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: designLab
    ? ["tsx", "ts", "jsx", "js", "dev.tsx"]
    : ["tsx", "ts", "jsx", "js"],

  // Fully static: every page is generated at build time from the published
  // Parquet/JSON. No server, no runtime data fetching, nothing to operate.
  output: "export",

  // Directory-style URLs so /np/bagmati/ works without a rewrite layer on the CDN.
  trailingSlash: true,

  images: { unoptimized: true },
};

export default nextConfig;
