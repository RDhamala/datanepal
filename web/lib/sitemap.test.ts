import { describe, expect, it } from "vitest";
import { siteUrls } from "./sitemap";
import { SITE_ORIGIN, siteUrl } from "./site";

/*
  Counts asserted against externally known expectations, not against the code
  that produced them. 7 provinces, 77 districts, 753 local governments: a
  sitemap that agrees with a partial geography load is the failure this
  platform is most exposed to, and it would still be valid XML.

  check-sitemap.mjs holds the other half -- that the list matches the HTML the
  build emitted -- which needs a build and so lives in postbuild rather than
  here.
*/

const urls = await siteUrls();
const paths = urls.map((e) => e.url.replace(SITE_ORIGIN, ""));
const count = (depth: number) =>
  paths.filter(
    (p) => p.startsWith("/np/") && p.split("/").filter(Boolean).length === depth,
  ).length;

describe("the sitemap", () => {
  it("lists every place page, at every level", () => {
    expect(paths).toContain("/np/");
    expect(count(2)).toBe(7); // provinces
    expect(count(3)).toBe(77); // districts
    expect(count(4)).toBe(753); // local governments
  });

  it("lists the indexes, the indicators and the topic hubs", () => {
    for (const p of [
      "/",
      "/places/",
      "/indicators/",
      "/compare/",
      "/datasets/",
      "/about/",
    ]) {
      expect(paths).toContain(p);
    }
    expect(paths.filter((p) => /^\/indicators\/.+/.test(p)).length).toBe(36);
    expect(paths.filter((p) => /^\/topics\/.+/.test(p)).length).toBe(10);
  });

  it("advertises no URL that redirects or does not ship", () => {
    // /topics/ 301s to /indicators/; /design-lab/ is not in a production build.
    expect(paths).not.toContain("/topics/");
    expect(paths.some((p) => p.includes("design-lab"))).toBe(false);
  });

  it("uses absolute, trailing-slash URLs on the canonical origin", () => {
    for (const { url } of urls) {
      expect(url.startsWith(`${SITE_ORIGIN}/`)).toBe(true);
      expect(url.endsWith("/")).toBe(true);
    }
  });

  it("names each page once", () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("dates pages from the data rather than from the build", () => {
    const dated = urls.filter((e) => e.lastModified);
    // Everything but /about/, which renders no published value.
    expect(dated.length).toBe(urls.length - 1);
    const today = new Date().toISOString().slice(0, 10);
    for (const e of dated) {
      expect(e.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // A date in the future is a build clock leaking in.
      expect(e.lastModified! <= today).toBe(true);
    }
  });
});

describe("siteUrl", () => {
  it("adds the slash the CDN serves, and keeps one already there", () => {
    expect(siteUrl("/places")).toBe(`${SITE_ORIGIN}/places/`);
    expect(siteUrl("/places/")).toBe(`${SITE_ORIGIN}/places/`);
    expect(siteUrl("/")).toBe(`${SITE_ORIGIN}/`);
  });

  it("refuses a relative path rather than producing a wrong origin", () => {
    expect(() => siteUrl("places/")).toThrow();
  });
});
