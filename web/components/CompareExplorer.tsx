"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ComparePanel } from "@/components/viz/ComparePanel";
import type { Unit } from "@/lib/types";
import { TYPE } from "@/lib/viz";

/*
  Comparison across the hierarchy, rather than within one parent.

  Every place page could already compare its own children -- a province its
  districts, a district its local governments -- and that is the comparison the
  data made easy rather than the one a reader arrives with. Humla against
  Kathmandu is two districts in different provinces; a ward officer comparing
  their municipality with the three next to it is four places under three
  parents. Neither was expressible.

  ComparePanel was already level-agnostic: it takes whatever places it is
  given. What was missing was a way to choose them, and the data on the client
  to choose from, because a static export has no server to ask.

  Two guards exist here that a within-parent comparison never needed. Mixing
  levels is allowed, because comparing a municipality with its district is a
  reasonable question -- but one of those contains the other, and the page says
  so rather than letting a reader read two independent figures. And the panel
  never offers a total: these places may overlap, and summing a rate is wrong
  even when they do not.
*/

const TYPE_LABEL: Record<string, string> = {
  country: "Country",
  province: "Province",
  district: "District",
  municipality: "Municipality",
  rural_municipality: "Rural municipality",
  metropolitan: "Metropolitan city",
  sub_metropolitan: "Sub-metropolitan city",
};

/** Order places are offered in: coarsest first, so Nepal is never buried. */
const TYPE_RANK: Record<string, number> = {
  country: 0,
  province: 1,
  district: 2,
  metropolitan: 3,
  sub_metropolitan: 3,
  municipality: 3,
  rural_municipality: 3,
};

type Measure = {
  id: string;
  label: string;
  name: string;
  unitId: string;
  unitName: string | null;
  unitKind: string | null;
  unitSymbol: string | null;
  additive: boolean;
};

type Row = [
  path: string,
  name: string,
  nameNe: string | null,
  type: string,
  ancestors: string[],
  values: (number | null)[],
];

type Index = { period: string; measures: Measure[]; places: Row[] };

/** Up to five. Beyond that the bars are too short to compare and the table
 *  scrolls sideways, which is the opposite of seeing things side by side. */
const MAX = 5;

export function CompareExplorer({ initial }: { initial: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [index, setIndex] = useState<Index | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => {
    const raw = params.get("p");
    const paths = raw ? raw.split(",").filter(Boolean) : initial;
    return paths.slice(0, MAX);
  }, [params, initial]);

  /*
    The index is fetched on mount rather than embedded in the page.

    141 KB of places is most of this route's weight and none of its first
    impression, and the same bargain the search index strikes: the page renders
    immediately, the data arrives behind it.
  */
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetch("/compare-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: Index) => {
        if (!cancelled) {
          setIndex(data);
          setLoadState("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byPath = useMemo(
    () => new Map((index?.places ?? []).map((r) => [r[0], r])),
    [index],
  );

  const setSelection = (paths: string[]) => {
    const next = new URLSearchParams(params.toString());
    if (paths.length) next.set("p", paths.join(","));
    else next.delete("p");
    // replace, not push: a comparison is one destination a reader adjusts, and
    // filling their back button with every intermediate selection would make
    // leaving the page take six presses.
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const add = (path: string) => {
    if (selected.includes(path) || selected.length >= MAX) return;
    setSelection([...selected, path]);
    setQuery("");
    inputRef.current?.focus();
  };
  const remove = (path: string) => setSelection(selected.filter((p) => p !== path));

  /**
   * The parent's published name, not its slug.
   *
   * De-slugging looks close enough until a name has a hyphen in it:
   * "nawalparasi-east" becomes "nawalparasi east", which is neither the name
   * nor the slug. The index already carries every ancestor's path, and every
   * ancestor is itself a row, so the real name is one lookup away.
   */
  const parentNameOf = (row: Row): string | null => {
    const nearest = row[4][0];
    if (!nearest || nearest === "nepal") return null;
    return byPath.get(nearest)?.[1] ?? null;
  };

  /* ----------------------------------------------------------- suggestions */

  const suggestions = useMemo(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored: { row: Row; score: number }[] = [];
    for (const row of index.places) {
      if (selected.includes(row[0])) continue;
      const name = row[1].toLowerCase();
      // Prefix beats contains, so typing "kath" offers Kathmandu before
      // Lekhnath. Nepali matches too, because the name is the data.
      const score = name.startsWith(q)
        ? 0
        : name.includes(q)
          ? 1
          : (row[2] ?? "").includes(query.trim())
            ? 2
            : -1;
      if (score < 0) continue;
      scored.push({ row, score });
    }
    scored.sort(
      (a, b) =>
        a.score - b.score ||
        (TYPE_RANK[a.row[3]] ?? 9) - (TYPE_RANK[b.row[3]] ?? 9) ||
        a.row[1].localeCompare(b.row[1]),
    );
    return scored.slice(0, 8).map((s) => s.row);
  }, [index, query, selected]);

  /* --------------------------------------------------------------- panel */

  const rows = selected
    .map((p) => byPath.get(p))
    .filter((r): r is Row => r !== undefined);

  const unitFor = (m: Measure): Unit | undefined =>
    ({
      unit_id: m.unitId,
      name_en: m.unitName ?? m.unitId,
      name_ne: null,
      unit_kind: m.unitKind ?? "count",
      symbol: m.unitSymbol,
      currency_code: null,
      price_basis: null,
    }) as unknown as Unit;

  const panelPlaces = rows.map((r) => ({
    placeId: r[0],
    name: r[1],
    href: r[0] === "nepal" ? "/np/" : `/np/${r[0]}/`,
    values: Object.fromEntries(
      (index?.measures ?? [])
        .map((m, i) => [m.id, r[5][i]] as const)
        .filter(([, v]) => v !== null && v !== undefined),
    ) as Record<string, number>,
  }));

  const panelMetrics = (index?.measures ?? []).map((m) => ({
    id: m.id,
    label: m.label,
    unit: unitFor(m),
    isAdditive: m.additive,
  }));

  /*
    Containment, named.

    Comparing Kathmandu with Bagmati is a fair question and a trap: one is
    inside the other, so the two figures are not independent and the larger
    already includes the smaller. Refusing the comparison would be
    paternalistic; letting it pass silently is how a reader ends up adding them.
  */
  const contained = (() => {
    // Grouped by the containing place. Listing each pair separately produced
    // "Nepal contains Humla; Nepal contains Kathmandu; Nepal contains Manang;
    // Nepal contains Sarlahi", which says one thing four times.
    const byParent = new Map<string, string[]>();
    for (const child of rows) {
      for (const parent of rows) {
        if (!child[4].includes(parent[0])) continue;
        byParent.set(parent[1], [...(byParent.get(parent[1]) ?? []), child[1]]);
      }
    }
    return [...byParent.entries()].map(([parent, children]) => {
      const list =
        children.length === 1
          ? children[0]
          : `${children.slice(0, -1).join(", ")} and ${children.at(-1)}`;
      return `${parent} contains ${list}`;
    });
  })();

  const levels = new Set(rows.map((r) => r[3]));

  return (
    <div>
      {/* ------------------------------------------------------ selection */}
      <div className="border-line mb-8 border-b pb-8">
        <label
          htmlFor="compare-add"
          className="text-label text-ink-faint mb-2 block uppercase"
        >
          Add a place
        </label>

        <div className="flex flex-wrap items-start gap-3">
          <div className="relative w-full max-w-md">
            <input
              id="compare-add"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={selected.length >= MAX || !index}
              placeholder={
                selected.length >= MAX
                  ? `Five places is the maximum`
                  : "Search any province, district or local government…"
              }
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls="compare-suggestions"
              className="border-line focus-visible:outline-accent w-full rounded-md border px-3 py-2 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-50"
            />

            {suggestions.length > 0 && (
              <ul
                id="compare-suggestions"
                className="border-line bg-surface divide-line absolute z-10 mt-1 w-full divide-y rounded-md border shadow-sm"
              >
                {suggestions.map((row) => (
                  <li key={row[0]}>
                    <button
                      type="button"
                      onClick={() => add(row[0])}
                      className="hover:bg-surface-sunken focus-visible:bg-surface-sunken flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left"
                    >
                      <span className="text-ink text-[14px]">
                        {row[1]}
                        {row[2] && (
                          <span className="text-ink-faint ne ml-2 text-[12px]">
                            {row[2]}
                          </span>
                        )}
                      </span>
                      {/*
                        Type and parent, always. Four places are called Madi
                        and 22 local-government names are shared, so a list of
                        bare names is a list a reader cannot choose from.
                      */}
                      <span
                        className="text-ink-faint shrink-0 text-right"
                        style={{ fontSize: TYPE.micro }}
                      >
                        {TYPE_LABEL[row[3]] ?? row[3]}
                        {parentNameOf(row) && <> · {parentNameOf(row)}</>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Chosen places, removable. */}
        {rows.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {rows.map((r) => (
              <li key={r[0]}>
                <button
                  type="button"
                  onClick={() => remove(r[0])}
                  className="border-line-strong text-ink-soft hover:bg-surface-sunken focus-visible:outline-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
                  aria-label={`Remove ${r[1]}`}
                >
                  {r[1]}
                  <span className="text-ink-faint" style={{ fontSize: TYPE.micro }}>
                    {TYPE_LABEL[r[3]] ?? r[3]}
                  </span>
                  <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --------------------------------------------------------- states */}
      {loadState === "error" && (
        <p className="text-ink-soft max-w-prose text-[14px]">
          The list of places could not be loaded. Reloading the page usually fixes it;
          the comparison itself needs no server.
        </p>
      )}

      {loadState === "loading" && !index && (
        <p className="text-ink-faint text-[14px]">Loading places…</p>
      )}

      {index && rows.length < 2 && (
        <p className="text-ink-soft max-w-prose text-[14px] leading-relaxed">
          Choose at least two places. They can be at any level and need not share a
          parent — two districts in different provinces, a municipality against its
          district, or any province against Nepal.
        </p>
      )}

      {/* ---------------------------------------------------------- panel */}
      {index && rows.length >= 2 && (
        <>
          {contained.length > 0 && (
            <p className="border-line-strong text-ink-soft mb-6 max-w-prose border-l-2 pl-3 text-[13px] leading-relaxed">
              {contained.join("; ")}. The larger figure already includes the smaller, so
              these are not independent places and their counts should not be added
              together.
            </p>
          )}

          <ComparePanel
            places={panelPlaces}
            metrics={panelMetrics}
            peerLabel="places"
            defaultMetricId="population"
          />

          <p
            className="text-ink-faint mt-5 max-w-prose leading-relaxed"
            style={{ fontSize: TYPE.small }}
          >
            {index.period} census · National Statistics Office.{" "}
            {levels.size > 1 &&
              "These places are at different levels of the hierarchy; rates compare directly, counts do not. "}
            Only measures published below the national level can be compared — the rest
            are national series with no breakdown by place.
          </p>
        </>
      )}
    </div>
  );
}
