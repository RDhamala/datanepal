/**
 * Tests for map label rendering choices.
 *
 * The important assertions are the negative ones. Nepal publishes no standard
 * set of English district abbreviations -- OCHA's COD leaves all 77
 * alternate-name fields empty, Wikidata has no P1813 short name for any of the
 * 79 district items, and NSO's census tables use full names -- so this module
 * must not invent any. An earlier version shortened "Nawalparasi East" to
 * "Nawalparasi E" and truncated names to "Ruk…", which produced "Nawal…" beside
 * "Nawalparasi E": a prefix of two different districts.
 */

import { describe, expect, it } from "vitest";
import { SHORT_NAMES, shortForms, textWidth, wrapName } from "./maplabels";

describe("shortForms", () => {
  it("always offers the full name first", () => {
    expect(shortForms("Kathmandu")[0]).toBe("Kathmandu");
    expect(shortForms("Sankhuwasabha")[0]).toBe("Sankhuwasabha");
  });

  it("leaves a single-word name completely alone", () => {
    for (const name of ["Sankhuwasabha", "Kavrepalanchok", "Okhaldhunga"]) {
      expect(shortForms(name)).toEqual([name]);
    }
  });

  /*
    The rule is not "no abbreviations". It is "no abbreviation this code
    invented". Nawalparasi East has a reviewed entry and so gets one; Rukum West
    does not, and the engine must not derive "Rukum W" by pattern even though it
    looks like the same case. That is the whole distinction between a table and
    a rule.
  */
  it("abbreviates only what the reviewed table names", () => {
    expect(shortForms("Nawalparasi East")).toEqual(["Nawalparasi East", "Nawal E"]);
    expect(shortForms("Rukum West")).toEqual(["Rukum West"]);
    expect(shortForms("Rukum East")).toEqual(["Rukum East"]);
  });

  it("never truncates a name it has no entry for", () => {
    for (const name of ["Sankhuwasabha", "Mukhiyapatti Musaharmiya", "Rukum West"]) {
      for (const form of shortForms(name)) {
        expect(form).not.toContain("…");
        // Every word survives verbatim; nothing is cut mid-word.
        for (const w of form.split(" ")) expect(name.split(" ")).toContain(w);
      }
    }
  });

  it("drops only the administrative type word, which the spine stores separately", () => {
    expect(shortForms("Phungling Municipality")).toContain("Phungling");
    expect(shortForms("Kathmandu Metropolitan City")).toContain("Kathmandu");
    // And never the place name itself.
    expect(shortForms("Phungling Municipality")).not.toContain("Municipality");
  });
});

describe("wrapName", () => {
  it("splits a multi-word name at its most balanced point", () => {
    expect(wrapName("Nawalparasi East")).toEqual(["Nawalparasi", "East"]);
    expect(wrapName("Mukhiyapatti Musaharmiya")).toEqual([
      "Mukhiyapatti",
      "Musaharmiya",
    ]);
  });

  it("refuses to split a single word", () => {
    expect(wrapName("Sankhuwasabha")).toBeNull();
    expect(wrapName("Kathmandu")).toBeNull();
  });

  it("makes a wrapped name narrower than the same name on one line", () => {
    const name = "Ganeshman Charnath";
    const wrapped = wrapName(name)!;
    const oneLine = textWidth(name, 10);
    const widestLine = Math.max(...wrapped.map((l) => textWidth(l, 10)));
    expect(widestLine).toBeLessThan(oneLine);
  });
});

describe("reviewed abbreviations", () => {
  it("offers the curated abbreviation, after the full name", () => {
    const forms = shortForms("Kathmandu");
    expect(forms[0]).toBe("Kathmandu");
    expect(forms).toContain("KTM");
    expect(shortForms("Bhaktapur")).toContain("BKT");
    expect(shortForms("Lalitpur")).toContain("LTP");
    expect(shortForms("Nawalparasi East")).toContain("Nawal E");
    expect(shortForms("Nawalparasi West")).toContain("Nawal W");
  });

  it("applies to a local government as well as its district", () => {
    // Both Kathmandu district and Kathmandu Metropolitan City abbreviate to KTM,
    // which is the point: the table is keyed on the name.
    expect(shortForms("Kathmandu Metropolitan City")).toContain("KTM");
    expect(shortForms("Lalitpur Metropolitan City")).toContain("LTP");
  });

  it("gives no two places the same abbreviation", () => {
    // A shared abbreviation would put one name on another place's shape, which
    // is the failure the generated version actually produced.
    const values = Object.values(SHORT_NAMES);
    expect(new Set(values).size).toBe(values.length);
  });

  it("abbreviates nothing that is not in the table", () => {
    for (const name of ["Sankhuwasabha", "Kavrepalanchok", "Morang", "Jhapa"]) {
      expect(shortForms(name)).toEqual([name]);
    }
  });

  it("keeps every abbreviation shorter than the name it replaces", () => {
    for (const [name, short] of Object.entries(SHORT_NAMES)) {
      expect(short.length).toBeLessThan(name.length);
    }
  });
});
