/*
  Two kinds of route never reach the public build.

  `noindex` keeps a page out of search results; it does not keep it off the
  CDN. So the gate is the build itself: a file named `page.dev.tsx` is only a
  route when `dev.tsx` is in pageExtensions. That covers the component
  laboratory at app/design-lab, and the two design directions under review
  beneath app/design-reset.

  They compile in `next dev`, in a build that asks for them explicitly:

      DESIGN_LAB=1 npm run build

  and in a Cloudflare Pages *branch preview*, which is how these get reviewed
  in a browser that is not this laptop. CF_PAGES_BRANCH is set by Pages on
  every deployment and equals the production branch only for production, so a
  preview gets the prototypes and datanepal.org never does.
*/
const previewBranch =
  process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== "main";

const prototypes =
  process.env.NODE_ENV !== "production" ||
  process.env.DESIGN_LAB === "1" ||
  Boolean(previewBranch);

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: prototypes
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
