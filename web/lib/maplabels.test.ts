/**
 * Tests for map label shortening.
 *
 * The interesting assertions here are the negative ones. A shortened label that
 * names a *different* real place is worse than no label, and Nepal has several
 * traps: Sankhuwasabha truncates to "Sankhu", which is a well-known settlement
 * near Kathmandu, and "Nawalparasi" alone is ambiguous between two separate
 * districts.
 */

import { describe, expect, it } from "vitest";
import { shortForms, textWidth } from "./maplabels";

describe("shortForms", () => {
  it("always offers the full name first", () => {
    expect(shortForms("Kathmandu")[0]).toBe("Kathmandu");
    expect(shortForms("Sankhuwasabha")[0]).toBe("Sankhuwasabha");
  });

  it("abbreviates a directional qualifier", () => {
    expect(shortForms("Nawalparasi East")).toContain("Nawalparasi E");
    expect(shortForms("Rukum West")).toContain("Rukum W");
  });

  it("never offers the base name of a split district on its own", () => {
    // "Nawalparasi" is ambiguous between Nawalparasi East and Nawalparasi West,
    // which are different districts with different populations.
    expect(shortForms("Nawalparasi East")).not.toContain("Nawalparasi");
    expect(shortForms("Rukum West")).not.toContain("Rukum");
  });

  it("never truncates, because a truncation can name another place", () => {
    // Every form offered must be reconstructible from the original by dropping
    // a generic word or abbreviating a direction -- never by cutting letters.
    for (const name of [
      "Sankhuwasabha",
      "Kavrepalanchok",
      "Sindhupalchok",
      "Okhaldhunga",
      "Mukhiyapatti Musaharmiya",
    ]) {
      for (const form of shortForms(name)) {
        const words = form.split(" ");
        const originals = name.split(" ");
        for (const w of words) {
          // A word is either present verbatim, or is a single-letter direction.
          expect(originals.includes(w) || w.length === 1).toBe(true);
        }
      }
    }
    expect(shortForms("Sankhuwasabha")).toEqual(["Sankhuwasabha"]);
  });

  it("drops generic administrative words that distinguish nothing", () => {
    expect(shortForms("Phungling Municipality")).toContain("Phungling");
    expect(shortForms("Kathmandu Metropolitan City")).toContain("Kathmandu");
  });

  it("returns forms that are no longer than the full name", () => {
    for (const name of ["Nawalparasi East", "Kathmandu Metropolitan City"]) {
      const forms = shortForms(name);
      const full = textWidth(forms[0], 10);
      for (const f of forms) expect(textWidth(f, 10)).toBeLessThanOrEqual(full);
    }
  });
});
