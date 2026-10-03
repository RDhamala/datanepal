import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dhadingProfile } from "@/lib/editorial";
import {
  BenchmarkLine,
  Figure,
  LeadStat,
  ROLE,
  Section,
  UnifiedShell,
} from "@/components/design-reset/unified";
import { GeoExplorer } from "@/components/editorial/GeoExplorer";
import {
  ordinal,
  PrototypeBar,
  prototypeRobots,
  SourceNote,
} from "@/components/design-reset/shared";
import { AgePyramid } from "@/components/AgePyramid";
import { RankedBars } from "@/components/charts";
import { DataDisclosure, DataGrid } from "@/components/viz/DataDisclosure";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Unified · Dhading District",
  robots: prototypeRobots,
};

/*
  Unified Dhading. A's identity and rhythm; the local governments are a
  GeoExplorer rather than a ranking.

  The thirteen local governments appear exactly twice: once in the explorer
  (map + its own ranking, one control) and once in the exact-data disclosure.
  No second ranking, no name list, no matrix.
*/
export default async function UnifiedDhading() {
  const d = await dhadingProfile({ maxWidth: 700, maxHeight: 900 });
  if (!d) notFound();

  const pop = d.population;
  const literacy = d.literacy;
  const female = d.literacyBySex.find((s) => s.sex === "female");
  const male = d.literacyBySex.find((s) => s.sex === "male");
  const withLit = d.localUnits.filter((u) => u.literacy !== null);
  const best = [...withLit].sort((a, b) => b.literacy! - a.literacy!)[0];
  const worst = [...withLit].sort((a, b) => a.literacy! - b.literacy!)[0];

  return (
    <UnifiedShell>
      <PrototypeBar
        direction="Unified — A's system, B's geography"
        other="/design-reset/"
        otherLabel="Compare with A and B"
      />

      {/* -------------------------------------------------- place identity */}
      <header className="max-w-page mx-auto px-5 pt-9 pb-8 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-ink-faint mb-5 text-[13px]">
          <Link href="/np/">Nepal</Link>
          <span className="mx-2">/</span>
          <Link href="/places/">Places</Link>
          <span className="mx-2">/</span>
          <Link href={`/np/${d.parent?.slug ?? ""}/`}>{d.parent?.name_en}</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">{d.place.name_en}</span>
        </nav>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:gap-14">
          <div>
            <p
              className="text-ink-faint text-[11px] uppercase"
              style={{ letterSpacing: "0.07em" }}
            >
              District · {d.parent?.name_en} Province
              {d.parent?.name_ne && (
                <span className="ne ml-2 normal-case" lang="ne">
                  {d.parent.name_ne}
                </span>
              )}
            </p>
            <h1
              className="text-ink mt-1.5 text-[clamp(2.25rem,1.8rem+2.2vw,3.25rem)] leading-[0.98] font-semibold tracking-[-0.035em]"
              style={ROLE.display}
            >
              {d.place.name_en} District
            </h1>
            <p className="text-ink-soft mt-3 max-w-[56ch] text-[14px] leading-relaxed">
              {d.provinceContext &&
                `${ordinal(d.provinceContext.rankByPopulation)} of ${d.provinceContext.districts} districts in ${d.parent?.name_en} by population, `}
              made up of {d.localUnits.length} local governments across{" "}
              {d.areaSqKm ? formatNumber(Math.round(d.areaSqKm)) : "—"} km².
            </p>
            {/* All 77 districts have name_ne NULL. Stated, not transliterated. */}
            <p className="text-ink-faint mt-2 text-[12px]">
              No Nepali name is published for any district · {d.place.ocha_pcode}
            </p>
          </div>

          {/* Key facts. Sans tabular: these sit in a column together. */}
          <aside className="lg:pt-6">
            <dl className="divide-line border-line divide-y border-y text-[13px]">
              {[
                ["Population", pop ? formatNumber(pop.total) : "—", "2021 census"],
                [
                  "Households",
                  d.households ? formatNumber(d.households.value) : "—",
                  "2021 census",
                ],
                ["People per km²", d.density ? d.density.toFixed(0) : "—", "Derived"],
                [
                  "Literacy",
                  literacy ? `${literacy.value.toFixed(1)}%` : "—",
                  d.literacyRank
                    ? `${ordinal(d.literacyRank.rank)} of ${d.literacyRank.of}`
                    : "2021",
                ],
              ].map(([k, v, n]) => (
                <div key={k} className="flex items-baseline gap-4 py-2.5">
                  <dt className="text-ink-faint w-28 shrink-0">{k}</dt>
                  <dd className="text-ink tabular font-medium">{v}</dd>
                  <dd className="text-ink-faint ml-auto text-[11px]">{n}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </header>

      {/* ---------------------------------------------- 01 people and homes */}
      {pop && (
        <Section
          n={1}
          title="People and households"
          intro="The census is the count. The later projection is a different measurement of the same thing, and the two are never combined."
        >
          <LeadStat
            label="Population, 2021 census"
            value={formatNumber(pop.total)}
            period="National Statistics Office"
            note={
              <>
                <p>
                  {formatNumber(pop.female)} women, {formatNumber(pop.male)} men —{" "}
                  {((pop.female / pop.total) * 100).toFixed(1)}% female.{" "}
                  {d.shareOfParent?.toFixed(1)}% of {d.parent?.name_en} lives here.
                </p>
                {pop.laterEstimate && (
                  <p className="border-line mt-3 border-l-2 pl-3">
                    A {pop.laterEstimate.period} projection puts it at{" "}
                    <strong className="text-ink font-semibold">
                      {formatNumber(pop.laterEstimate.value)}
                    </strong>{" "}
                    — modelled by UNFPA, not counted.
                  </p>
                )}
              </>
            }
          >
            {pop.bands.length > 0 && (
              <Figure
                title={`Population by five-year age band and sex, ${pop.bandPeriod}`}
                subtitle="Projected, not enumerated — a different reference period from the count beside it."
                source={
                  <SourceNote
                    source={{
                      publisher: "United Nations Population Fund",
                      publisherNe: null,
                      acquiredFrom: "United Nations Population Fund",
                      acquiredIndirectly: false,
                      licence: "cc-by-igo-3.0",
                      url: "",
                      retrieved: "",
                    }}
                  />
                }
              >
                <AgePyramid bands={pop.bands} period={pop.bandPeriod ?? pop.period} />
              </Figure>
            )}
          </LeadStat>
        </Section>
      )}

      {/* ------------------------------------------------- 02 who can read */}
      {literacy && (
        <Section
          n={2}
          title="Who can read"
          intro="Below both its province and the country."
          action={{ href: "/indicators/literacy-rate/", label: "Literacy nationally" }}
        >
          <LeadStat
            label="Literacy rate, 2021 census"
            value={`${literacy.value.toFixed(1)}%`}
            period="Population aged 5 and over"
            note={
              <>
                {d.literacyRank && (
                  <p>
                    <strong className="text-ink font-semibold">
                      {ordinal(d.literacyRank.rank)} of {d.literacyRank.of}
                    </strong>{" "}
                    districts — {d.literacyRank.top} leads, {d.literacyRank.bottom} is
                    last.
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
              <BenchmarkLine
                rows={d.literacyBenchmarks}
                caption="Literacy rate, 2021 census. Dhading marked in black."
              />
              {d.literacyBreakdown.length > 0 && (
                <Figure
                  title="Population aged 5 and over, by literacy status"
                  subtitle="The census partition behind the rate."
                  source={<SourceNote source={literacy.source} />}
                >
                  <RankedBars
                    label="Population aged 5 and over by literacy status, 2021"
                    noun="categories"
                    rowLabel="Literacy status"
                    valueLabel="People"
                    compact
                    rows={d.literacyBreakdown.map((r) => ({
                      name: r.label,
                      value: r.all,
                    }))}
                  />
                  <DataDisclosure
                    count={d.literacyBreakdown.length}
                    noun="categories"
                    scroll={false}
                  >
                    <DataGrid
                      caption="Population aged 5 and over by literacy status and sex, 2021"
                      columns={["Literacy status", "All", "Female", "Male"]}
                      rows={d.literacyBreakdown.map((r) => [
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

      {/* ------------------------------------- 03 the local governments */}
      <Section
        n={3}
        title={`${d.localUnits.length} local governments`}
        intro={
          best && worst
            ? `Literacy runs ${worst.literacy!.toFixed(1)}% to ${best.literacy!.toFixed(1)}% — a ${(best.literacy! - worst.literacy!).toFixed(1)}-point spread inside one district.`
            : undefined
        }
        action={{ href: "/compare/", label: "Compare places" }}
      >
        {d.localMap && (
          <GeoExplorer
            features={d.localMap.features}
            metrics={d.localMap.metrics}
            rows={d.localUnits.map((u) => ({
              placeId: u.placeId,
              name: u.name,
              nameNe: u.nameNe,
              href: u.href,
            }))}
            width={d.localMap.width}
            height={d.localMap.height}
            title="Dhading by local government"
            source={
              <SourceNote source={literacy?.source ?? d.households?.source ?? null} />
            }
          />
        )}

        {/* The one exact-data fallback for these thirteen places. */}
        <div className="mt-6">
          <DataDisclosure count={d.localUnits.length} noun="local governments">
            <DataGrid
              caption="Local governments of Dhading, 2021 census"
              columns={[
                "Local government",
                "Type",
                "Population",
                "Households",
                "Literacy",
              ]}
              rows={d.localUnits.map((u) => [
                u.name,
                u.placeType.replace(/_/g, " "),
                u.population !== null ? formatNumber(u.population) : "—",
                u.households !== null ? formatNumber(u.households) : "—",
                u.literacy !== null ? `${u.literacy.toFixed(1)}%` : "—",
              ])}
            />
          </DataDisclosure>
        </div>
      </Section>

      {/* ----------------------------------------------------- 04 sources */}
      <Section
        n={4}
        title="Where this page comes from"
        intro="Only the datasets behind something rendered above — two of six."
        action={{ href: "/datasets/", label: "All datasets" }}
      >
        <ul className="divide-line border-line divide-y border-t text-[13px]">
          {d.sources.map((s) => (
            <li
              key={s.dataset_id}
              className="flex flex-wrap items-baseline gap-x-4 py-3"
            >
              <span className="text-ink">{s.title}</span>
              <span className="text-ink-faint text-[12px]">{s.publisher}</span>
              <span className="text-ink-faint tabular ml-auto text-[11px]">
                {s.licence} · retrieved {s.retrieved}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </UnifiedShell>
  );
}
