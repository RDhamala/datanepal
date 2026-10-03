import Link from "next/link";

/* Formatting, provenance and the prototype banner. Anything that decides
   layout belongs to a direction, not here. */

/* --------------------------------------------- escaping the site chrome */

/**
 * Hide the production header/footer so a direction can own its own chrome.
 *
 * The clean fix is two root layouts via route groups, which would mean moving
 * all 890 production routes. Not worth it for a dev-only prototype.
 * display:none also drops them from the accessibility tree; each shell ships
 * its own skip link.
 */
export function EscapeSiteChrome() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          body > header, body > footer, body > a[href="#main"] { display: none !important; }
          #main { max-width: none !important; width: 100% !important;
                  padding: 0 !important; margin: 0 !important; }
        `,
      }}
    />
  );
}

/** The skip link each prototype shell owns, since the real one is hidden. */
export function SkipLink({ to = "#proto-main" }: { to?: string }) {
  return (
    <a
      href={to}
      className="bg-surface-raised border-line focus-visible:outline-accent sr-only rounded border px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus-visible:outline-2"
    >
      Skip to content
    </a>
  );
}

/* ----------------------------------------------------- the prototype bar */

/** Says this is a prototype, and links to the other direction. */
export function PrototypeBar({
  direction,
  other,
  otherLabel,
}: {
  direction: string;
  other: string;
  otherLabel: string;
}) {
  return (
    <div className="border-line bg-surface-sunken border-b">
      <div className="max-w-wide mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 text-[11px] sm:px-8">
        <span className="text-ink-faint uppercase" style={{ letterSpacing: "0.07em" }}>
          Design prototype
        </span>
        <span className="text-ink-soft">{direction}</span>
        <span className="text-ink-faint">·</span>
        <Link href="/design-reset/" className="underline underline-offset-2">
          Both directions
        </Link>
        <span className="text-ink-faint">·</span>
        <Link href={other} className="underline underline-offset-2">
          {otherLabel}
        </Link>
        <span className="text-ink-faint ml-auto hidden sm:inline">
          Real published data · not the live site
        </span>
      </div>
    </div>
  );
}

/** Shared robots directive: these must never be indexed. */
export const prototypeRobots = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
} as const;

export {
  coverageSentence,
  figureText,
  NotPublished,
  ordinal,
  periodText,
  SourceNote,
} from "@/components/editorial/format";
