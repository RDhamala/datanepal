import Link from "next/link";
import type { EditorialPlace } from "@/lib/editorial";
import { TYPE_LABEL } from "@/lib/editorial";
import { BenchmarkLine, Figure, LeadStat, ROLE, Section, StackedBar } from "./system";
import { GeoExplorer } from "./GeoExplorer";
import { ordinal } from "./format";
import { AgePyramid } from "@/components/AgePyramid";
import { RankedBars } from "@/components/charts";
import { pluralLower } from "@/lib/words";
import { DataDisclosure, DataGrid } from "@/components/viz/DataDisclosure";
import { formatNumber, indicatorSlug } from "@/lib/data";

/*
  One template for all 838 place pages.

  Levels differ in three ways and no more: Nepal has no ancestor to compare
  against, a local government has no children to explore, and the noun for the
  level below changes. Everything else is the same page.
*/

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-surface-sunken text-ink-faint rounded px-1.5 py-0.5 text-[11px]">
      {children}
    </span>
  );
}

export function PlacePage({ data }: { data: EditorialPlace }) {
  const {
    place,
    parent,
    ancestors,
    population: pop,
    households,
    literacy,
    literacyBySex,
    literacyBenchmarks,
    literacyRank,
    literacyBreakdown,
    areaSqKm,
    density,
    shareOfParent,
    children,
    siblings,
    nationalOnly,
    nationalTopics,
    distributions,
    sources,
  } = data;

  const isNepal = place.place_type === "country";
  const typeLabel = TYPE_LABEL[place.place_type] ?? "Place";

  /*
    The h1 suffix, the eyebrow and the locator sentence are the three places a
    reader learns what kind of thing this is. They are per-level and spelled
    out rather than derived: "Metropolitan City" is not the title case of
    "metropolitan", and "one of Nepal's seven provinces" is not a template.
  */
  const CASED: Record<string, string> = {
    metropolitan: "Metropolitan City",
    sub_metropolitan: "Sub-Metropolitan City",
    municipality: "Municipality",
    rural_municipality: "Rural Municipality",
  };
  const LOWER: Record<string, string> = {
    metropolitan: "metropolitan city",
    sub_metropolitan: "sub-metropolitan city",
    municipality: "municipality",
    rural_municipality: "rural municipality",
  };
  const suffix =
    place.place_type === "province"
      ? " Province"
      : place.place_type === "district"
        ? " District"
        : "";
  const grandparent = ancestors[1];
  const eyebrow = isNepal
    ? "Country"
    : place.place_type === "province"
      ? "Province"
      : place.place_type === "district"
        ? `District · ${parent?.name_en} Province`
        : `${CASED[place.place_type] ?? typeLabel} · ${parent?.name_en} District`;
  const locator = isNepal
    ? `A federal democratic republic of ${children?.rows.length ?? 7} provinces, 77 districts and 753 local governments.`
    : place.place_type === "province"
      ? `One of Nepal’s seven provinces, made up of ${children?.rows.length ?? 0} districts.`
      : place.place_type === "district"
        ? `A district of ${parent?.name_en} Province, made up of ${children?.rows.length ?? 0} local governments.`
        : `A ${LOWER[place.place_type] ?? "local government"} in ${parent?.name_en} District, ${grandparent?.name_en} Province, one of ${siblings?.rows.length ?? 0} local governments there.`;
  const female = literacyBySex.find((s) => s.sex === "female");
  const male = literacyBySex.find((s) => s.sex === "male");
  const nation = literacyBenchmarks.find((b) => b.label === "Nepal" && !b.isSelf);
  const gap = literacy && nation ? literacy.value - nation.value : null;
  const explorer = children ?? siblings;

  // Built with explicit checks: `value && {...}` collapses a real 0 to false.
  const facts: { k: string; v: string; chip: string | null; note: string | null }[] =
    [];
  if (pop)
    facts.push({
      k: "Population",
      v: formatNumber(pop.total),
      chip: String(pop.period),
      note: pop.laterEstimate
        ? `${formatNumber(pop.laterEstimate.value)} projected for ${pop.laterEstimate.period}`
        : null,
    });
  if (households)
    facts.push({
      k: "Households",
      v: formatNumber(households.value),
      chip: households.period,
      note: pop ? `${(pop.total / households.value).toFixed(2)} people each` : null,
    });
  if (areaSqKm !== null)
    facts.push({
      k: "Area",
      v: `${formatNumber(Math.round(areaSqKm))} km²`,
      chip: null,
      note: density !== null ? `${density.toFixed(0)} per km²` : null,
    });
  if (literacy)
    facts.push({
      k: "Literacy",
      v: `${literacy.value.toFixed(1)}%`,
      chip: literacy.period,
      note: literacyRank
        ? `${ordinal(literacyRank.rank)} of ${literacyRank.of}`
        : shareOfParent !== null && parent
          ? `${shareOfParent.toFixed(1)}% of ${parent.name_en}`
          : null,
    });

  // Hierarchical crumbs, nearest ancestor last.
  const crumbs = [...ancestors].reverse();

  return (
    <>
      {/* -------------------------------------------------- place identity */}
      <header className="pb-10">
        <nav aria-label="Breadcrumb" className="text-ink-faint mb-6 text-[13px]">
          <Link href="/np/" className="text-ink-faint hover:text-brand no-underline">
            Nepal
          </Link>
          {crumbs
            .filter((a) => a.place_type !== "country")
            .map((a) => (
              <span key={a.place_id}>
                <span className="mx-2" aria-hidden="true">
                  /
                </span>
                <Link
                  href={hrefOf(a, ancestors)}
                  className="text-ink-faint hover:text-brand no-underline"
                >
                  {a.name_en}
                </Link>
              </span>
            ))}
          {!isNepal && (
            <>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              <span className="text-ink-soft">{place.name_en}</span>
            </>
          )}
        </nav>

        <p
          className="text-ink-faint text-[11px] uppercase"
          style={{ letterSpacing: "0.08em" }}
        >
          {eyebrow}
        </p>
        <h1
          className="text-ink mt-2 text-[clamp(2.25rem,1.8rem+2.2vw,3.25rem)] leading-[0.98] font-semibold tracking-[-0.035em]"
          style={ROLE.display}
        >
          {place.name_en}
          {suffix}
        </h1>
        {place.name_ne && (
          <p
            className="text-brand ne mt-1.5 text-[clamp(1.125rem,0.95rem+0.7vw,1.5rem)] leading-tight font-medium"
            lang="ne"
            style={{ fontFamily: "var(--font-devanagari)" }}
          >
            {place.name_ne}
          </p>
        )}

        <p className="text-ink-soft mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px]">
          <span>{locator}</span>
          <span className="bg-surface-sunken text-ink-faint rounded px-1.5 py-0.5 font-mono text-[11px]">
            {place.ocha_pcode}
          </span>
        </p>
        {/* All 77 districts carry a NULL Nepali name. Stated, not guessed. */}
        {!place.name_ne && !isNepal && (
          <p className="text-ink-faint mt-1.5 text-[12px]">
            No Nepali name is published for this place.
          </p>
        )}
      </header>

      {/* ------------------------------------------------------ fact strip */}
      <div
        className="bg-surface border-line divide-line grid grid-cols-2 divide-y overflow-hidden rounded-xl border sm:divide-y-0 lg:grid-cols-4"
        style={{ boxShadow: "var(--shadow-raise)" }}
      >
        {facts.map((f, i) => (
          <div
            key={f.k}
            className={`border-line px-5 py-5 ${i > 0 ? "lg:border-l" : ""} ${i % 2 === 1 ? "border-l" : ""}`}
          >
            <p
              className="text-ink-faint text-[10.5px] uppercase"
              style={{ letterSpacing: "0.08em" }}
            >
              {f.k}
            </p>
            <p
              className="text-ink mt-2 text-[clamp(1.375rem,1.1rem+1vw,1.875rem)] leading-none font-semibold tracking-[-0.03em]"
              style={ROLE.leadFigure}
            >
              {f.v}
            </p>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {f.chip && <Chip>{f.chip}</Chip>}
              {f.note && <span className="text-ink-faint text-[11px]">{f.note}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* ------------------------------------ 01 Population & Demographics */}
      {pop && (
        <Section
          contained={false}
          n={1}
          title="Population & Demographics"
          action={{ href: "/topics/population/", label: "Population nationally" }}
        >
          <LeadStat
            label={`Population, ${pop.period} census`}
            value={formatNumber(pop.total)}
            period="National Statistics Office"
            note={
              <>
                <p>
                  {formatNumber(pop.female)} women, {formatNumber(pop.male)} men —{" "}
                  {((pop.female / pop.total) * 100).toFixed(1)}% female.
                  {shareOfParent !== null &&
                    parent &&
                    ` ${shareOfParent.toFixed(1)}% of ${parent.name_en}.`}
                </p>
                {pop.laterEstimate && (
                  <p className="border-line mt-3 border-l-2 pl-3">
                    A {pop.laterEstimate.period} projection puts it at{" "}
                    <strong className="text-ink font-semibold">
                      {formatNumber(pop.laterEstimate.value)}
                    </strong>{" "}
                    — modelled, not counted.
                  </p>
                )}
              </>
            }
          >
            {pop.bands.length > 0 && (
              <div>
                <h3 className="text-ink mb-1 text-[14px] font-semibold">
                  Age and sex structure
                </h3>
                <p className="text-ink-faint mb-3 text-[12px]">
                  Five-year bands, {pop.bandPeriod} projection — a different reference
                  period from the count beside it.
                </p>
                <AgePyramid bands={pop.bands} period={pop.bandPeriod ?? pop.period} />
              </div>
            )}
          </LeadStat>
        </Section>
      )}

      {/* --------------------------------------------------- 02 Education */}
      {literacy && (
        <Section
          contained={false}
          n={2}
          title="Education"
          action={{ href: "/indicators/literacy-rate/", label: "Literacy nationally" }}
        >
          <LeadStat
            label={`Literacy rate, ${literacy.period} census`}
            value={`${literacy.value.toFixed(1)}%`}
            period="Population aged 5 and over"
            note={
              <>
                {/* The comparison the checker requires -- and Nepal must not
                    have one, since a national figure against itself is a
                    fabrication. */}
                {gap !== null && nation && (
                  <p>
                    <strong
                      className={`font-semibold ${gap >= 0 ? "text-rise" : "text-fall"}`}
                    >
                      {Math.abs(gap).toFixed(1)} pp{" "}
                      {gap >= 0
                        ? "above the national figure"
                        : "below the national figure"}
                    </strong>
                    {literacyRank &&
                      ` · ${ordinal(literacyRank.rank)} of ${literacyRank.of}`}
                    .
                  </p>
                )}
                {female && male && (
                  <p className="mt-2">
                    {male.value.toFixed(1)}% of men, {female.value.toFixed(1)}% of women
                    — a {(male.value - female.value).toFixed(1)}-point gap.
                  </p>
                )}
              </>
            }
          >
            <div className="space-y-8">
              {literacyBenchmarks.length > 1 && (
                <BenchmarkLine
                  rows={literacyBenchmarks}
                  caption={`Literacy rate, ${literacy.period} census. ${place.name_en} marked in black.`}
                />
              )}
              {literacyBreakdown.length > 0 && (
                <Figure
                  title="Population aged 5 and over, by literacy status"
                  subtitle="The census partition behind the rate."
                >
                  {/* A partition, drawn as one. Four bars from zero made four
                      census categories that sum to the population aged 5 and
                      over look like four unrelated magnitudes. */}
                  <StackedBar
                    parts={literacyBreakdown.map((r) => ({
                      label: r.label,
                      value: r.all,
                    }))}
                    total={literacyBreakdown.reduce((n, r) => n + r.all, 0)}
                    caption={`${formatNumber(literacyBreakdown.reduce((n, r) => n + r.all, 0))} people aged 5 and over. Counts are in the table.`}
                  />
                  <DataDisclosure
                    count={literacyBreakdown.length}
                    noun="categories"
                    scroll={false}
                  >
                    <DataGrid
                      caption={`Population aged 5 and over by literacy status and sex, ${literacy.period}`}
                      columns={["Literacy status", "All", "Female", "Male"]}
                      rows={literacyBreakdown.map((r) => [
                        r.label,
                        formatNumber(r.all),
                        formatNumber(r.female),
                        formatNumber(r.male),
                      ])}
                    />
                  </DataDisclosure>
                </Figure>
              )}
            </div>
          </LeadStat>
        </Section>
      )}

      {/* ------------------------------------------ 03 the level below, or
                                                      the peers it sits among */}
      {explorer && explorer.map && (
        <Section
          contained={false}
          tone="accent"
          n={3}
          title={
            children
              ? children.noun === "local governments"
                ? "Local governments"
                : children.noun === "provinces"
                  ? "Provinces by population"
                  : children.noun === "districts"
                    ? "Districts by population"
                    : `${children.rows.length} ${children.noun}`
              : "In context"
          }
          action={{ href: "/places/", label: "All places" }}
        >
          <p className="text-ink-faint mb-5 text-[12px]">
            {children
              ? `${children.rows.length} ${children.noun}. By population, 2021 census.`
              : `Where ${place.name_en} sits among the ${siblings?.rows.length} local governments of ${parent?.name_en}. By population, 2021 census.`}
          </p>
          <GeoExplorer
            features={explorer.map.features}
            metrics={explorer.map.metrics}
            rows={explorer.rows.map((r) => ({
              placeId: r.placeId,
              name: r.name,
              nameNe: r.nameNe,
              href: r.href,
            }))}
            width={explorer.map.width}
            height={explorer.map.height}
            title={
              children
                ? `${place.name_en} by ${children.noun.replace(/s$/, "")}`
                : `${parent?.name_en} by ${explorer.noun.replace(/s$/, "")}`
            }
          />
          <div className="mt-6">
            <DataDisclosure count={explorer.rows.length} noun={explorer.noun}>
              <DataGrid
                caption={`${children ? place.name_en : parent?.name_en} by ${explorer.noun}, census`}
                columns={[
                  "Place",
                  { label: "Type", numeric: false },
                  "Population",
                  "Households",
                  "Literacy",
                ]}
                rows={explorer.rows.map((r) => [
                  r.name,
                  (TYPE_LABEL[r.placeType] ?? r.placeType).toLowerCase(),
                  r.population !== null ? formatNumber(r.population) : "—",
                  r.households !== null ? formatNumber(r.households) : "—",
                  r.literacy !== null ? `${r.literacy.toFixed(1)}%` : "—",
                ])}
              />
            </DataDisclosure>
          </div>
        </Section>
      )}

      {/* --------------------------------- Nepal only: the other domains */}
      {isNepal && nationalTopics.length > 0 && (
        <Section
          contained={false}
          n={4}
          title="Every domain"
          intro="Nepal is the only place with all ten. Below it, five census measures reach province, district and local-government level."
          action={{ href: "/indicators/", label: "Indicator index" }}
        >
          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {nationalTopics.map((t) => (
              <div key={t.slug} className="border-line border-t pt-3.5">
                <Link
                  href={`/topics/${t.slug}/`}
                  className="text-ink text-[14px] font-semibold no-underline hover:underline"
                >
                  {t.name}
                </Link>
                <dl className="mt-2 space-y-1.5">
                  {t.figures.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <dt className="text-ink-faint truncate text-[12px]">{f.label}</dt>
                      <dd className="text-ink tabular shrink-0 text-[12.5px]">
                        {f.value}
                        <span className="text-ink-faint ml-1.5 text-[11px]">
                          {f.period}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          {/* Elections has no national total: these are seats won by each
              party, and their sum is the size of the house rather than a fact
              about the country. */}
          {distributions.length > 0 && (
            <div className="border-line mt-9 border-t pt-7">
              <Figure
                title="Elections"
                subtitle="No single national total: these are seats won by each party, and their sum is the size of the house."
              >
                <RankedBars
                  label={`${distributions[0].dimensionName} results, ${distributions[0].period}`}
                  noun={pluralLower(distributions[0].dimensionName)}
                  rowLabel={distributions[0].dimensionName}
                  valueLabel="Value"
                  compact
                  rows={distributions[0].members.slice(0, 8).map((mem) => ({
                    name: mem.name,
                    nameNe: mem.nameNe,
                    value: mem.value,
                  }))}
                />
              </Figure>
            </div>
          )}
        </Section>
      )}

      {/* ------------------------------------------------------ 04 sources */}
      <Section contained={false} n={isNepal ? 5 : 4} title="Sources and coverage">
        <ul className="divide-line border-line divide-y border-t text-[13px]">
          {sources.map((s) => (
            <li
              key={s.dataset_id}
              className="flex flex-wrap items-baseline gap-x-4 py-3"
            >
              <span className="text-ink">{s.title}</span>
              <span className="text-ink-faint text-[12px]">{s.publisher}</span>
              <span className="text-ink-faint tabular ml-auto text-[11px]">
                {s.licence}
              </span>
            </li>
          ))}
        </ul>

        {/*
          Coverage, stated in the direction that is useful here. Below the
          nation: which measures stop at the nation. On Nepal: how many go
          deeper, because that is what decides whether a reader's district has
          an answer. Never a "Not yet covered" section.
        */}
        <p className="text-ink-faint mt-5 max-w-[70ch] text-[12px] leading-relaxed">
          {isNepal ? (
            <>
              Five of {nationalOnly.length + 5} measures are published below the
              national level, all from the 2021 census.{" "}
              <Link href="/indicators/">All indicators and their coverage →</Link>
            </>
          ) : (
            <>
              Measures such as{" "}
              {namesInline(nationalOnly).map((i, n, a) => (
                <span key={i.id}>
                  {n > 0 && (n === a.length - 1 ? `${i.sep}and ` : i.sep)}
                  <Link href={`/indicators/${indicatorSlug(i.id)}/`}>{i.name}</Link>
                </span>
              ))}{" "}
              are published for Nepal as a whole and are not broken down to this level
              by their source, so they have no section here.{" "}
              <Link href="/indicators/">All indicators and their coverage →</Link>
            </>
          )}
        </p>
      </Section>
    </>
  );
}

/**
 * Three measure names, ready to read inside a sentence.
 *
 * Eight of the eighty indicator names contain a comma of their own --
 * "Inflation, consumer prices", "Remittances received, total" -- so a
 * comma-joined list of three of them read as five items: "inflation, consumer
 * prices, gdp per capita, remittances received, total are published for Nepal
 * as a whole". Prefer names without one, and fall back to the serial semicolon,
 * which exists for exactly this. Renaming a measure to tidy the sentence is not
 * on the table: the name is the publisher's.
 */
function namesInline(
  inds: { id: string; name: string }[],
  take = 3,
): { id: string; name: string; sep: string }[] {
  const picks = [...inds]
    .sort((a, b) => Number(a.name.includes(",")) - Number(b.name.includes(",")))
    .slice(0, take);
  const sep = picks.some((p) => p.name.includes(",")) ? "; " : ", ";
  return picks.map((p) => ({
    id: p.id,
    // A name may end in a full stop of its own; inside a sentence it reads as
    // one sentence ending early.
    name: p.name.replace(/\.$/, "").toLowerCase(),
    sep,
  }));
}

/** URL for an ancestor, rebuilt from the chain the page already holds. */
function hrefOf(
  target: { place_id: string; slug: string },
  chain: { place_id: string; slug: string; place_type: string }[],
): string {
  const parts: string[] = [];
  for (let i = chain.length - 1; i >= 0; i--) {
    const a = chain[i];
    if (a.place_type === "country") continue;
    parts.push(a.slug);
    if (a.place_id === target.place_id) break;
  }
  return `/np/${parts.join("/")}/`;
}
