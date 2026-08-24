import Link from "next/link";
import { Search } from "@/components/Search";

/*
  The page a lost visitor actually lands on -- broken links, old bookmarks,
  typos in a P-code-shaped URL -- deserves more than Next's bare default. It
  had none of the site's own voice: no search, no way back, not even the
  footer's links close enough to read without hunting.

  Same job as every other page: say what happened, then hand back the two
  ways anyone finds anything here -- search, or one of the three browse
  entry points.
*/

export default function NotFound() {
  return (
    <div className="py-12">
      <p className="text-label text-ink-faint mb-3 uppercase">404</p>
      <h1 className="text-display text-ink font-semibold">Page not found</h1>
      <p className="text-ink-soft mt-3 max-w-prose text-[15px] leading-relaxed">
        There&rsquo;s nothing published at this address. It may have moved, or the
        link might have a typo — try searching for what you&rsquo;re after.
      </p>

      <div className="mt-8 max-w-lg">
        <Search
          size="large"
          placeholder="Search places, indicators, datasets…"
          examples={["Kathmandu", "inflation", "Dhanusa", "population"]}
        />
      </div>

      <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
        <li>
          <Link href="/">Home</Link>
        </li>
        <li>
          <Link href="/places/">Places</Link>
        </li>
        <li>
          <Link href="/topics/">Topics</Link>
        </li>
        <li>
          <Link href="/indicators/">Indicators</Link>
        </li>
        <li>
          <Link href="/datasets/">Dataset catalogue</Link>
        </li>
      </ul>
    </div>
  );
}
