/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static: every page is generated at build time from the published
  // Parquet/JSON. No server, no runtime data fetching, nothing to operate.
  output: "export",

  // Directory-style URLs so /np/bagmati/ works without a rewrite layer on the CDN.
  trailingSlash: true,

  images: { unoptimized: true },
};

export default nextConfig;
