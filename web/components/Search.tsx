"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/*
  Search over places, topics, indicators and datasets.

  The index is built from published data (scripts/build-search-index.mjs) and
  fetched lazily on first focus, so it costs nothing until someone actually
  intends to search. 849 entries at 118 KB uncompressed is small enough to
  filter synchronously on every keystroke without debouncing.

  This is the only client-side JavaScript on the site. It earns that: the brief
  requires search to work, and there is no way to search 753 local units — which
  have no pages of their own — from a static HTML crawl.

  Accessibility follows the combobox pattern: aria-expanded on the input,
  aria-activedescendant tracking the highlighted option, arrow keys to move,
  Enter to open, Escape to dismiss. It degrades to a plain text input with no
  script, which is honest rather than broken — the visible affordance is a
  filter over links, not a promise of server-side search.
*/

type Entry = {
  /** kind */
  k: "place" | "topic" | "indicator" | "dataset";
  /** title (English) */
  t: string;
  /** Nepali name */
  n: string | null;
  /** context line */
  c: string;
  /** href */
  h: string;
};

const KIND_LABEL: Record<Entry["k"], string> = {
  place: "Place",
  topic: "Topic",
  indicator: "Indicator",
  dataset: "Dataset",
};

// Rank kinds so a search for "population" surfaces the indicator before 700
// place names that happen to match nothing better.
const KIND_RANK: Record<Entry["k"], number> = {
  topic: 0,
  indicator: 1,
  place: 2,
  dataset: 3,
};

const MAX_RESULTS = 10;

/*
  Fold the spelling variations that make Devanagari search fail silently.

  Kathmandu is written काठमाडौँ in our data (candrabindu, U+0901) and काठमाडौं by
  most people typing it (anusvara, U+0902). Both are correct Nepali; both mark
  the same nasalisation. Without folding them, searching the common spelling
  returns nothing for the capital city, which is the kind of failure nobody
  reports — they just conclude search is broken.

  Zero-width joiners get stripped for the same reason: they are invisible, they
  vary between input methods, and they turn an exact match into no match.

  This is orthographic folding, not transliteration. We never map Devanagari to
  Latin or guess at romanisation — a wrong guess is worse than a visible gap.
*/
function fold(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/ँ/g, "ं").replace(/[‌‍]/g, "");
}

/** An index entry with its folded search fields precomputed once at load. */
type Indexed = Entry & { ft: string; fn: string; fc: string };

function score(entry: Indexed, q: string): number | null {
  if (entry.fn.includes(q)) return 5 + KIND_RANK[entry.k];
  if (entry.ft === q) return 0 + KIND_RANK[entry.k];
  if (entry.ft.startsWith(q)) return 1 + KIND_RANK[entry.k];
  // Word-boundary match beats a mid-word one: "east" should find
  // "Nawalparasi East" before "Easternmost".
  if (entry.ft.includes(` ${q}`)) return 3 + KIND_RANK[entry.k];
  if (entry.ft.includes(q)) return 6 + KIND_RANK[entry.k];
  if (entry.fc.includes(q)) return 9 + KIND_RANK[entry.k];
  return null;
}

export function Search({
  size = "default",
  placeholder = "Search places, indicators, datasets…",
  examples,
}: {
  size?: "default" | "large";
  placeholder?: string;
  examples?: string[];
}) {
  const [index, setIndex] = useState<Indexed[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);

  // Fetch on first interaction, once.
  const load = () => {
    if (index !== null) return;
    fetch("/search-index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Entry[]) =>
        // Fold once here rather than per keystroke: 849 entries × 6 fields is
        // cheap once and wasteful on every character.
        setIndex(
          data.map((e) => ({
            ...e,
            ft: fold(e.t),
            fn: e.n ? fold(e.n) : "",
            fc: fold(e.c),
          })),
        ),
      )
      .catch(() => setIndex([]));
  };

  const q = fold(query.trim());
  const results: Indexed[] =
    !q || !index
      ? []
      : index
          .map((e) => ({ e, s: score(e, q) }))
          .filter((r): r is { e: Indexed; s: number } => r.s !== null)
          .sort((a, b) => a.s - b.s || a.e.t.length - b.e.t.length)
          .slice(0, MAX_RESULTS)
          .map((r) => r.e);

  useEffect(() => setActive(0), [query]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (entry: Indexed) => {
    setOpen(false);
    setQuery("");
    router.push(entry.h);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  };

  const large = size === "large";
  const showList = open && q.length > 0;

  return (
    <div ref={wrapper} className="relative">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search DataNepal
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`text-ink-faint pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 ${
            large ? "size-4" : "size-3.5"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="6.8" cy="6.8" r="4.6" />
          <path d="M10.3 10.3 14 14" strokeLinecap="round" />
        </svg>
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && results.length ? `${listId}-opt-${active}` : undefined
          }
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            load();
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`border-line-strong bg-surface text-ink placeholder:text-ink-faint focus:border-series-1 w-full rounded-md border pr-3 outline-none ${
            large ? "py-3 pl-10 text-[15px]" : "py-1.5 pl-9 text-[13px]"
          }`}
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="border-line bg-surface absolute z-50 mt-1.5 max-h-80 w-full overflow-auto rounded-md border shadow-lg"
        >
          {index === null && (
            <li className="text-ink-faint px-3 py-2.5 text-[13px]">Loading…</li>
          )}
          {index !== null && results.length === 0 && (
            <li className="text-ink-faint px-3 py-2.5 text-[13px]">
              Nothing found for “{query.trim()}”.
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={`${r.k}-${r.h}-${r.t}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(r);
              }}
              className={`cursor-pointer px-3 py-2 ${
                i === active ? "bg-selected" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink text-[13px] font-medium">
                  {r.t}
                  {r.n && <span className="text-ink-faint ne font-normal"> {r.n}</span>}
                </span>
                <span className="text-ink-faint shrink-0 text-[11px]">
                  {KIND_LABEL[r.k]}
                </span>
              </div>
              <div className="text-ink-faint text-[11px]">{r.c}</div>
            </li>
          ))}
        </ul>
      )}

      {examples && examples.length > 0 && !showList && (
        <p className="text-ink-faint mt-2.5 text-[12px]">
          Try{" "}
          {examples.map((ex, i) => (
            <span key={ex}>
              {i > 0 && ", "}
              <button
                type="button"
                onClick={() => {
                  load();
                  setQuery(ex);
                  setOpen(true);
                }}
                className="text-link underline underline-offset-2"
              >
                {ex}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
