import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  benchmarksFor,
  boundaries,
  comparisonFor,
  compositionFor,
  country,
  formatNumber,
  formatPercent,
  indicators,
  localUnitsOf,
  metricMapFor,
  observations,
  placeBySlug,
  placeProfile,
  places,
  populationOf,
  seriesFor,
  spreadFor,
  units,
} from "@/lib/data";
import { coverageByIndicator } from "@/lib/coverage";
import { AgePyramid } from "@/components/AgePyramid";
import { MetricMap } from "@/components/MetricMap";
import { ReferenceMap } from "@/components/ReferenceMap";
import { RankedBars, TrendChart } from "@/components/charts";
import { Benchmark } from "@/components/viz/Benchmark";
import { Composition, Distribution } from "@/components/viz/Composition";
import { DataDisclosure, DataGrid } from "@/components/viz/DataDisclosure";
import { Figure } from "@/components/viz/Figure";
import { HeadlineMetric, HeadlineMetricGroup } from "@/components/viz/HeadlineMetric";
import {
  CoverageBadge,
  PeriodChip,
  SourceDetail,
  SourceLine,
} from "@/components/viz/SourceLine";
import { Crumbs, PageHeader } from "@/components/ui";
import { DESIGN_LAB_ENABLED } from "@/lib/design-lab";

/*
  The component laboratory.

  Not in the navigation and not indexed. It exists so the reusable pieces can
  be judged next to each other rather than one page at a time -- which is how
  four different number sizes, five labels for the same disclosure and two map
  label renderers all arrived without anyone deciding on them.

  Real data throughout, deliberately. A laboratory built on lorem ipsum agrees
  with whatever the component does; this one has to survive Nepal's actual
  long place names, its missing values, and its mixed reference periods.
*/

export const metadata: Metadata = {
  title: "Design lab",
  description: "Internal component reference. Not part of the published site.",
  robots: { index: false, follow: false },
};

/*
  This file is `page.dev.tsx`, not `page.tsx`.

  Next only treats a file as a route if its extension is in `pageExtensions`,
  and next.config.mjs adds `dev.tsx` to that list only when the laboratory is
  wanted. So an ordinary production build does not see a route here at all:
  no HTML, no 404 body, no unlinked file on the CDN -- the page is not
  compiled.

  An earlier attempt used an optional catch-all returning no params, which
  reads as the obvious thing to do and is rejected outright: `output: export`
  treats an empty params list as a missing generateStaticParams and fails the
  build.
*/

function Bench({
  n,
  title,
  owns,
  children,
  note,
}: {
  n: number;
  title: string;
  /** Which external reference owns this problem, per docs/design/reference-index.md. */
  owns: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line scroll-mt-20 border-t pt-8 pb-14" id={`c${n}`}>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-ink-faint tabular text-[12px]">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="text-heading text-ink font-semibold">{title}</h2>
        <span className="text-ink-faint text-[11px]">reference: {owns}</span>
      </div>
      {note && (
        <p className="text-ink-soft mb-7 max-w-prose text-[13px] leading-relaxed">
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

function Variant({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-label text-ink-faint mb-3 uppercase">{label}</p>
      {children}
    </div>
  );
}

export default async function DesignLab() {
  // Belt and braces: if the route is ever reached in a build that did not ask
  // for it, it is a 404 rather than an internal page served quietly.
  if (!DESIGN_LAB_ENABLED) notFound();

  const np = await country();
  const bagmati = await placeBySlug("province", "bagmati");
  const dhading = bagmati
    ? await placeBySlug("district", "dhading", bagmati.place_id)
    : undefined;
  if (!np || !bagmati || !dhading) return null;

  const [
    pop,
    nationalPop,
    profile,
    benchmarks,
    series,
    allUnits,
    localUnits,
    litMix,
    litSpread,
    districtCmp,
    obs,
    allPlaces,
    inds,
  ] = await Promise.all([
    populationOf(dhading),
    populationOf(np),
    placeProfile(dhading),
    benchmarksFor(dhading, ["literacy_rate", "population_density"]),
    seriesFor(np),
    units(),
    localUnitsOf(dhading.place_id),
    compositionFor(dhading, "population_5plus", "literacy_status"),
    spreadFor("district", "literacy_rate"),
    comparisonFor("population", "district"),
    observations(),
    places(),
    indicators(),
  ]);

  const localMap = await metricMapFor(
    localUnits,
    ["population", "households", "literacy_rate"],
    { maxWidth: 520, maxHeight: 420 },
  );
  const geo = await boundaries();
  const districtShapes = geo
    .filter((g) => g.parent_place_id === bagmati.place_id && g.admin_level === 2)
    .map((g) => ({
      placeId: g.place_id,
      name: g.name_en,
      nameNe: g.name_ne,
      geometryGeoJson: g.geometry_geojson,
      href: `/np/${bagmati.slug}/${g.slug}/`,
      group: "district",
    }));

  const coverage = coverageByIndicator(obs, allPlaces);
  const literacy = profile
    .flatMap((t) => t.metrics)
    .find((m) => m.indicatorId === "literacy_rate");
  const inflation = series.find(
    (s) => s.indicator.indicator_id === "cpi_inflation_annual",
  );
  const persons = allUnits.find((u) => u.unit_id === "persons");
  const localPop = new Map(
    (await comparisonFor("population", "rural_municipality")).rows.map(
      (r) => [r.place.place_id, r.value] as const,
    ),
  );

  const coverageSamples = (
    [
      "population",
      "literacy_rate",
      "life_expectancy_at_birth",
      "unemployment_rate",
    ] as const
  )
    .map((id) => ({
      indicator: inds.find((i) => i.indicator_id === id),
      coverage: coverage.get(id),
    }))
    .filter((x) => x.indicator && x.coverage);

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Design lab" }]} />

      <PageHeader
        eyebrow="Internal"
        title="Component laboratory"
        meta={
          <>
            Eight reusable responsibilities, on real data. Not linked from navigation
            and not indexed — see <Link href="/np/bagmati/dhading/">Dhading</Link> for
            the same components composed into a page.
          </>
        }
      />

      <p className="text-ink-soft mb-12 max-w-prose text-[13px] leading-relaxed">
        Each bench names the external product that owns its design problem, per{" "}
        <code className="font-mono text-[12px]">docs/design/reference-index.md</code>.
        The references are not averaged: DataNepal keeps one visual language, and each
        product contributes a solution to one question rather than a style.
      </p>

      {/* ------------------------------------------------------------ 01 */}
      <Bench
        n={1}
        title="HeadlineMetric"
        owns="Data México — vintage on every figure"
        note={
          <>
            One current value, said once. Two sizes, not a card each: a module’s leading
            figure takes <code className="font-mono">--text-stat-lead</code>, a figure
            in a group takes <code className="font-mono">--text-stat</code>. The
            reference period is a chip bound to the number rather than grey text under
            it, because this site publishes a 2021 census count beside a 2023 projection
            and the difference between them has to survive a glance.
          </>
        }
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <Variant label="Lead — enumerated">
            <HeadlineMetric
              lead
              label="Population"
              value={pop ? formatNumber(pop.total) : null}
              unit="people"
              period={pop?.period}
              status="census"
              source="National Statistics Office"
              context={`${formatPercent((pop?.total ?? 0) / (nationalPop?.total ?? 1), 2)} of Nepal.`}
            />
          </Variant>

          <Variant label="Lead — modelled, with change">
            <HeadlineMetric
              lead
              label="Consumer price inflation"
              value={inflation?.latest ? `${inflation.latest.value.toFixed(1)}%` : null}
              period={inflation?.latest?.year}
              status="estimate"
              source="World Bank"
              change={{ text: "2.0 pp from 2024", direction: "down" }}
            />
          </Variant>

          <Variant label="Missing — a sentence, not a dash">
            <HeadlineMetric
              label="Life expectancy at birth"
              value={null}
              missingNote="Published for Nepal only — the source does not break this down to districts."
            />
          </Variant>

          <Variant label="Long value, narrow column">
            <HeadlineMetric
              label="Remittance inflow"
              value="NPR 1,860,000,000,000"
              period={2024}
              status="estimate"
              source="Nepal Rastra Bank"
            />
          </Variant>
        </div>

        <div className="mt-10">
          <Variant label="Grouped — rules, not cards">
            <HeadlineMetricGroup
              columns={4}
              metrics={[
                {
                  label: "Population",
                  value: pop ? formatNumber(pop.total) : null,
                  period: pop?.period,
                  status: "census",
                },
                {
                  label: "Households",
                  value: formatNumber(
                    profile
                      .flatMap((t) => t.metrics)
                      .find((m) => m.indicatorId === "households")?.value ?? null,
                  ),
                  period: 2021,
                  status: "census",
                },
                {
                  label: "Literacy rate",
                  value: literacy ? `${literacy.value.toFixed(1)}%` : null,
                  period: literacy?.period,
                  status: "census",
                },
                {
                  label: "Area",
                  value: formatNumber(dhading.area_sqkm),
                  unit: "km²",
                },
              ]}
            />
          </Variant>
        </div>
      </Bench>

      {/* ------------------------------------------------------------ 02 */}
      <Bench
        n={2}
        title="BenchmarkComparison"
        owns="Census Reporter — context at the point of reading"
        note="Place against its own lineage: district, province, Nepal. Zero-anchored, gap stated in the unit's own terms, rank among same-type peers. Only methodologically comparable observations — a rate against a rate, same period, same denominator. An ancestor with no published figure is absent, never interpolated."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          {benchmarks.map((b) => (
            <Variant key={b.indicatorId} label="Place · parent · Nepal">
              <Benchmark data={b} />
            </Variant>
          ))}
        </div>
      </Bench>

      {/* ------------------------------------------------------------ 03 */}
      <Bench
        n={3}
        title="TrendChart"
        owns="Our World in Data — chart anatomy"
        note="A line for change over time, inside the shared Figure frame: title, subtitle, visual, readout, caption, table. A single observation is not a timeline and is not drawn as one — it degrades to a metric, which is what the census-only indicators get."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <Variant label="A real series">
            {inflation && (
              <TrendChart
                points={inflation.points}
                unit={inflation.unit}
                label="Consumer price inflation"
              />
            )}
          </Variant>

          <Variant label="One observation — not a timeline">
            <HeadlineMetric
              lead
              label="Literacy rate"
              value={literacy ? `${literacy.value.toFixed(1)}%` : null}
              period={literacy?.period}
              status="census"
              source="National Statistics Office"
              context="A single census observation. A line through one point would invent a trend."
            />
          </Variant>
        </div>
      </Bench>

      {/* ------------------------------------------------------------ 04 */}
      <Bench
        n={4}
        title="RankedPlaces"
        owns="Eurostat — where a place sits among peers"
        note="Horizontal bars, always: Nepali place names are long and vertical bars force rotated labels. Zero-anchored, because a truncated axis on a bar chart exaggerates exactly the differences bars exist to show. Compact beside a map, expanded on its own."
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <Variant label="Expanded — with table fallback">
            <RankedBars
              label="Population by district, Bagmati"
              rows={districtCmp.rows
                .filter((r) => r.place.parent_place_id === bagmati.place_id)
                .slice(0, 8)
                .map((r) => ({
                  name: r.place.name_en,
                  nameNe: r.place.name_ne,
                  href: `/np/${bagmati.slug}/${r.place.slug}/`,
                  value: r.value,
                }))}
              unit={persons}
              valueLabel="People"
            />
          </Variant>

          <Variant label="Compact — beside a map, no duplicate table">
            <RankedBars
              compact
              label="Largest local governments of Dhading"
              rows={localUnits
                .map((u) => ({
                  name: u.name_en,
                  nameNe: u.name_ne,
                  value: localPop.get(u.place_id) ?? 0,
                }))
                .filter((r) => r.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 6)}
              unit={persons}
              valueLabel="People"
            />
          </Variant>
        </div>

        {litSpread.length > 4 && literacy && (
          <div className="mt-10">
            <Variant label="Distribution — the spread a ranking hides">
              <Figure
                title="Literacy rate across all 77 districts"
                subtitle="Each district a dot, the median marked. A rank of 1 of 77 means something different depending on how tightly the field clusters."
              >
                <Distribution
                  values={litSpread}
                  subject={{
                    id: dhading.place_id,
                    name: dhading.name_en,
                    value: literacy.value,
                  }}
                  format={(v) => `${v.toFixed(1)}%`}
                  peerLabel="districts"
                />
              </Figure>
            </Variant>
          </div>
        )}
      </Bench>

      {/* ------------------------------------------------------------ 05 */}
      <Bench
        n={5}
        title="GeoExplorer"
        owns="Eurostat — map-led exploration · ONS — hierarchy"
        note={
          <>
            Two modes, one cartography. <strong>Administrative</strong>: fill is
            identity, the map is navigation, every shape a real link.{" "}
            <strong>Choropleth</strong>: fill is a quantile-classed value with a
            switchable measure. Labels carry a halo in the page colour, which is what
            finally made “Dhunibenshi” readable where it overhangs its own polygon — it
            inked white on a dark fill and vanished on the page beyond it. Names that
            cannot fit become a dot and are named in the table rather than shrunk past
            legibility.
          </>
        }
      >
        <div className="grid gap-10 xl:grid-cols-2">
          <Variant label="Administrative — navigation">
            <ReferenceMap
              shapes={districtShapes}
              outlines={[]}
              maxWidth={520}
              maxHeight={420}
              caption={`The ${districtShapes.length} districts of ${bagmati.name_en} Province. Fill is identity, not magnitude — select a district to open it.`}
            />
          </Variant>

          <Variant label="Choropleth — magnitude, switchable measure">
            {localMap && (
              <MetricMap
                features={localMap.features}
                metrics={localMap.metrics}
                width={localMap.width}
                height={localMap.height}
                caption={`${localMap.features.length} local governments of Dhading, 2021 census.`}
              />
            )}
          </Variant>
        </div>
      </Bench>

      {/* ------------------------------------------------------------ 06 */}
      <Bench
        n={6}
        title="BreakdownChart"
        owns="Our World in Data — composition · Datawrapper — direct labels"
        note="A real categorical breakdown with its denominator stated. No pie charts: a 100% stacked bar compares across places where a pie shows one, stays legible under 120px, and stacks in a list. The pyramid keeps two distinct colours because the sex distinction is the information."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          {litMix && (
            <Variant label="Composition — 100% stacked">
              <Figure
                title="Literacy status, population aged 5 and over"
                subtitle={`The four categories the census reports. Denominator: ${formatNumber(litMix.total)} people aged 5 and over in Dhading, 2021.`}
                tableCount={litMix.slices.length}
                tableNoun="categories"
                table={
                  <DataGrid
                    caption="Literacy status"
                    columns={["Status", "People", "Share"]}
                    rows={litMix.slices.map((s) => [
                      s.label,
                      formatNumber(s.value),
                      formatPercent(s.value / litMix.total),
                    ])}
                  />
                }
              >
                <Composition slices={litMix.slices} total={litMix.total} />
              </Figure>
            </Variant>
          )}

          {pop && pop.bands.length > 0 && (
            <Variant label="Population pyramid">
              <AgePyramid bands={pop.bands} period={pop.bandPeriod ?? pop.period} />
            </Variant>
          )}
        </div>
      </Bench>

      {/* ------------------------------------------------------------ 07 */}
      <Bench
        n={7}
        title="DataTable and the shared disclosure"
        owns="Census Reporter — exact-data fallback"
        note="One owner for “show me the numbers”. Nine components had grown their own disclosure with five different labels between them; the control now lives in one place and the label is composed from the count and the noun, so a reader who learns it on a chart knows it under the map below."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <Variant label="Composed label, from count and noun">
            <DataDisclosure count={localUnits.length} noun="local governments">
              <DataGrid
                caption="Local governments of Dhading"
                columns={["Local government", "नेपाली", "Population 2021"]}
                rows={localUnits.map((u) => [
                  u.name_en,
                  u.name_ne ?? "",
                  localPop.has(u.place_id)
                    ? formatNumber(localPop.get(u.place_id))
                    : "",
                ])}
              />
            </DataDisclosure>
          </Variant>

          <Variant label="Explicit label, for non-tabular content">
            <DataDisclosure label="What these measure" scroll={false}>
              <dl className="max-w-prose space-y-2 p-4 text-[13px]">
                <dt className="text-ink-soft">Literacy rate</dt>
                <dd className="text-ink-faint leading-relaxed">
                  Share of the population aged 5 and over who can both read and write,
                  2021 census.
                </dd>
              </dl>
            </DataDisclosure>
          </Variant>
        </div>
      </Bench>

      {/* ------------------------------------------------------------ 08 */}
      <Bench
        n={8}
        title="SourceLine and coverage"
        owns="ONS — source placement · Data México — vintage chips"
        note="Provenance at two levels from one vocabulary: a compact line under every figure, the full chain where a reader has asked for it. Coverage is the other half — of 36 indicators, 5 reach below the national level and 31 do not, and until now nothing said which."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <Variant label="Compact — the public variant">
            <div className="space-y-3">
              <SourceLine period="2021 census" publisher="National Statistics Office" />
              <SourceLine period="2025" publisher="World Bank" />
              <SourceLine period="2023" status="projection" publisher="UNFPA" />
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <PeriodChip period={2021} />
                <PeriodChip period={2023} status="projection" />
                <PeriodChip period="2024 Q1" status="preliminary" />
              </div>
            </div>
          </Variant>

          <Variant label="Coverage — what a reader can actually get">
            <ul className="divide-line border-line divide-y border-y">
              {coverageSamples.map(({ indicator, coverage: c }) => (
                <li
                  key={indicator!.indicator_id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                >
                  <span className="text-ink text-[13px]">{indicator!.name_en}</span>
                  <CoverageBadge coverage={c!} />
                </li>
              ))}
            </ul>
            <p className="text-ink-faint mt-3 max-w-prose text-[12px] leading-relaxed">
              {coverageSamples[0]?.coverage?.note}
            </p>
          </Variant>
        </div>

        <div className="mt-10">
          <Variant label="Expanded — the dataset variant">
            <SourceDetail
              publisher="National Statistics Office, Nepal"
              acquiredFrom="Humanitarian Data Exchange"
              vintage="2021 census"
              licence="CC BY 4.0"
              retrieved="2026-08-24"
              revises={false}
              caveats={[
                "Institutional population is reported at district level only, so local governments sum to 28,925,480 rather than to the national total.",
                "Two local governments resolve through an explicit name-fix seed rather than an automated match.",
              ]}
              downloads={[
                { label: "observations.parquet", href: "/data/observations.parquet" },
              ]}
            />
          </Variant>
        </div>
      </Bench>

      {/* ------------------------------------------------------- type scale */}
      <Bench
        n={9}
        title="Type roles"
        owns="Datawrapper — limit the number of sizes"
        note="Explicit roles rather than per-page patches. The rule the pages depend on: a figure outranks the heading above it, and nothing outranks the page title. FactStrip had hardcoded its values at 22px — exactly where section headings top out — so a district's population rendered at the same size as the words above it."
      >
        <dl className="divide-line border-line divide-y border-y">
          {[
            [
              "display",
              "text-display",
              "Page identity — one per page",
              "Dhading District",
            ],
            ["stat-lead", "text-stat-lead", "A module's leading figure", "325,710"],
            ["stat", "text-stat", "A figure in a group", "325,710"],
            [
              "title",
              "text-title",
              "Secondary title — the Devanagari pairing",
              "धादिङ",
            ],
            ["heading", "text-heading", "Section heading", "Population & Demographics"],
            ["body", "text-[15px]", "Body", "Resident population, 2021 census."],
            [
              "label",
              "text-label uppercase",
              "Micro label above a figure",
              "Population",
            ],
          ].map(([role, cls, use, sample]) => (
            <div
              key={role}
              className="grid grid-cols-1 items-baseline gap-x-6 gap-y-1 py-4 sm:grid-cols-[7rem_13rem_1fr]"
            >
              <dt className="text-ink font-mono text-[12px]">{role}</dt>
              <dd className="text-ink-faint text-[12px]">{use}</dd>
              <dd className={`${cls} text-ink font-semibold`}>{sample}</dd>
            </div>
          ))}
        </dl>
      </Bench>
    </>
  );
}
