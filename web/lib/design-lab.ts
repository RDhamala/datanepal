/**
 * Whether the component laboratory is part of this build.
 *
 * `noindex` keeps the page out of search results; it does not keep it off the
 * CDN. Anyone with the URL still reaches an internal page that names its own
 * defects and links to a doc path, on a site whose whole argument is that what
 * it publishes is deliberate. So the gate is at build time instead: the route
 * is an optional catch-all whose `generateStaticParams` returns nothing when
 * this is false, and a static export emits no HTML for a route with no params.
 *
 * On in `next dev` and in any build that asks for it explicitly, which is what
 * a preview deploy does:
 *
 *     DESIGN_LAB=1 npm run build
 *
 * Off in an ordinary production build, with nothing to configure and nothing
 * to remember.
 */
export const DESIGN_LAB_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.DESIGN_LAB === "1";
