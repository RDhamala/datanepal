import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dhadingProfile } from "@/lib/editorial";
import {
  BenchmarkLine,
  Chapter,
  EditorialFigure,
  EditorialShell,
  LeadStat,
  SERIF,
} from "@/components/design-reset/editorial";
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
  title: "Direction A — Editorial · Dhading District",
  robots: prototypeRobots,
};

/*
  Direction A, Dhading.

  The page answers one question in order: how many people, how they are
  distributed in age and sex, how well they read, and how unevenly that is
  spread across the thirteen local governments. Each chapter has one lead
  figure and one graphic, and the exact numbers live in a disclosure under
  whichever graphic is the primary one.

  The production district page renders every indicator at the same size in the
  same shape, so nothing on it is ever the answer. The point of this layout is
  that a reader who stops after chapter one has still learned the main thing.

  Deliberately *not* here: a second ranked table of the same 13 local
  governments, a separate name list, and a platform-wide source inventory.
*/
export default async function EditorialDhading() {
  const d = await dhadingProfile({ maxWidth: 560, maxHeight: 420 });
  if (!d) notFound();

  const pop = d.population;
  const literacy = d.literacy;
  const female = d.literacyBySex.find((s) => s.sex === "female");
  const male = d.literacyBySex.find((s) => s.sex === "male");
  const best = d.localUnits
    .filter((u) => u.literacy !== null)
    .sort((a, b) => b.literacy! - a.literacy!)[0];
  const worst = d.localUnits
    .filter((u) => u.literacy !== null)
    .sort((a, b) => a.literacy! - b.literacy!)[0];

  return (
    <EditorialShell>
      <PrototypeBar
        direction="A — Editorial Statistical Publication"
        other="/design-reset/atlas/dhading/"
        otherLabel="See Direction B"
      />

      {/* ------------------------------------------------------ identity */}
      <header className="max-w-page mx-auto px-5 pt-12 pb-10 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-ink-faint mb-6 text-[13px]">
          <Link href="/np/">Nepal</Link>
          <span className="mx-2">/</span>
          <Link href="/places/">Places</Link>
          <span className="mx-2">/</span>
          <Link href={`/np/${d.parent?.slug ?? ""}/`}>{d.parent?.name_en}</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">{d.place.name_en}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-16">
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
              className="text-ink mt-2 text-[clamp(2.5rem,1.9rem+2.8vw,3.75rem)] leading-[0.98] font-semibold tracking-[-0.035em]"
              style={{ fontFamily: SERIF }}
            >
              {d.place.name_en} District
            </h1>
            {/*
              No Nepali name here, and that is the data being honest rather
              than the design forgetting. All 77 districts have name_ne NULL in
              the published spine. This project's rule is that a guessed
              romanisation or transliteration in a reference dataset is worse
              than a visible gap, so the gap is visible.
            */}
            <p className="text-ink-faint mt-3 text-[12px]">
              No Nepali name is published for any district. Not transliterated.
            </p>
          </div>

          <aside className="lg:pt-10">
            <dl className="divide-line border-line divide-y border-y text-[13px]">
              {[
                ["Province", d.parent?.name_en ?? "—"],
                ["Local governments", `${d.localUnits.length}`],
                [
                  "Area",
                  d.areaSqKm ? `${formatNumber(Math.round(d.areaSqKm))} km²` : "—",
                ],
                [
                  "Of the province",
                  d.provinceContext
                    ? `${d.provinceContext.rankByPopulation} of ${d.provinceContext.districts} districts by population`
                    : "—",
                ],
                ["P-code", d.place.ocha_pcode ?? "—"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                >
                  <dt className="text-ink-faint">{k}</dt>
                  <dd className="text-ink-soft tabular text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </header>

      {/* --------------------------------------------- 01 how many people */}
      {pop && (
        <Chapter
          n={1}
          title="How many people"
          standfirst="Census count and later projection, kept apart."
        >
          <LeadStat
            label="Population, 2021 census"
            value={formatNumber(pop.total)}
            period={`${pop.period} census · National Statistics Office`}
            note={
              <>
                <p>
                  {formatNumber(pop.female)} women and {formatNumber(pop.male)} men —{" "}
                  {((pop.female / pop.total) * 100).toFixed(1)}% female, against{" "}
                  {d.shareOfParent?.toFixed(1)}% of {d.parent?.name_en}&rsquo;s people
                  living here.
                </p>
                {pop.laterEstimate && (
                  <p className="border-line mt-4 border-l-2 pl-3">
                    A later projection puts the {pop.laterEstimate.period} population at{" "}
                    <strong className="text-ink font-semibold">
                      {formatNumber(pop.laterEstimate.value)}
                    </strong>
                    . Modelled, not counted — UNFPA.
                  </p>
                )}
              </>
            }
          >
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
              {[
                [
                  "Households",
                  d.households ? formatNumber(d.households.value) : "—",
                  "2021 census",
                ],
                [
                  "People per household",
                  d.households ? (pop.total / d.households.value).toFixed(2) : "—",
                  "Both from the 2021 census",
                ],
                [
                  "People per km²",
                  d.density ? d.density.toFixed(0) : "—",
                  "Census population ÷ area",
                ],
              ].map(([label, value, note]) => (
                <div key={label} className="border-line border-t pt-3">
                  <p
                    className="text-ink-faint text-[11px] uppercase"
                    style={{ letterSpacing: "0.07em" }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-ink tabular mt-1 text-[26px] leading-none font-semibold"
                    style={{ fontFamily: SERIF }}
                  >
                    {value}
                  </p>
                  <p className="text-ink-faint mt-1 text-[11px]">{note}</p>
                </div>
              ))}
            </div>
          </LeadStat>
        </Chapter>
      )}

      {/* ------------------------------------------------ 02 age and sex */}
      {pop && pop.bands.length > 0 && (
        <Chapter
          n={2}
          title="Age and sex"
          standfirst={
            <>
              Five-year bands from the {pop.bandPeriod} UNFPA projection — the only
              source publishing age detail at district level, and a different reference
              period from the census count above. Both sides share one scale.
            </>
          }
        >
          <EditorialFigure
            title={`Population by five-year age band and sex, ${pop.bandPeriod}`}
            subtitle="Projected, not enumerated."
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
          </EditorialFigure>
        </Chapter>
      )}

      {/* ------------------------------------------------- 03 who can read */}
      {literacy && (
        <Chapter
          n={3}
          title="Who can read"
          standfirst={
            <>
              Dhading sits below both its province and the country. It is the gap
              between women and men, and the gap between its own local governments, that
              the single district figure hides.
            </>
          }
          action={{ href: "/indicators/literacy-rate/", label: "Literacy nationally" }}
        >
          <LeadStat
            label="Literacy rate, 2021 census"
            value={`${literacy.value.toFixed(1)}%`}
            period={`${literacy.period} census · population aged 5 and over`}
            note={
              d.literacyRank && (
                <>
                  <p>
                    <strong className="text-ink font-semibold">
                      {ordinal(d.literacyRank.rank)} of {d.literacyRank.of}
                    </strong>{" "}
                    districts, between {d.literacyRank.top} at the top and{" "}
                    {d.literacyRank.bottom} at the bottom.
                  </p>
                  {female && male && (
                    <p className="mt-3">
                      {male.value.toFixed(1)}% of men and {female.value.toFixed(1)}% of
                      women — a gap of {(male.value - female.value).toFixed(1)} points.
                    </p>
                  )}
                </>
              )
            }
          >
            <div className="space-y-10">
              <BenchmarkLine
                rows={d.literacyBenchmarks}
                caption="Literacy rate, 2021 census. Dhading marked in black."
              />

              {d.literacyBreakdown.length > 0 && (
                <EditorialFigure
                  title="Population aged 5 and over, by literacy status"
                  subtitle="The census partition behind the rate."
                  source={<SourceNote source={literacy.source} />}
                  wide
                >
                  <RankedBars
                    label="Population aged 5 and over by literacy status, 2021"
                    noun="categories"
                    rowLabel="Literacy status"
                    valueLabel="People"
                    rows={d.literacyBreakdown.map((r) => ({
                      name: r.label,
                      value: r.all,
                    }))}
                  />
                </EditorialFigure>
              )}
            </div>
          </LeadStat>
        </Chapter>
      )}

      {/* --------------------------------------- 04 the local governments */}
      <Chapter
        n={4}
        title={`${d.localUnits.length} local governments`}
        standfirst={
          best && worst ? (
            <>
              Literacy runs from {worst.literacy!.toFixed(1)}% in {worst.name} to{" "}
              {best.literacy!.toFixed(1)}% in {best.name} — a spread of{" "}
              {(best.literacy! - worst.literacy!).toFixed(1)} points inside one
              district, wider than the gap between Dhading and Nepal.
            </>
          ) : undefined
        }
        action={{ href: "/compare/", label: "Compare places" }}
      >
        {/*
          One primary visual, one exact-data fallback. The production page
          showed these thirteen as a map, a table, a ranking and two name
          lists; this direction is chart-led, so the ranking is primary and the
          map belongs to Direction B.
        */}
        {/*
          One ranking, not two. An earlier draft had local governments ranked
          by population here and ranked again by literacy in a sidebar, plus a
          table -- three views of the same thirteen places, which is the exact
          pattern this page exists to stop. Literacy is what the chapter is
          about, so literacy is the ranking; population is a column in the
          table below.

          `compact` matters: RankedBars renders its own data disclosure when it
          is not compact, and the table below is already that disclosure. Two
          "View all 13" toggles a few pixels apart is the duplicate-wrapper bug
          in another costume.
        */}
        <EditorialFigure
          title="Local governments by literacy rate, 2021 census"
          subtitle="District average 72.4%. Two municipalities, eleven rural municipalities."
          wide
        >
          <RankedBars
            label="Local governments of Dhading by literacy rate, 2021 census"
            noun="local governments"
            rowLabel="Local government"
            valueLabel="Literacy rate"
            unit={literacy?.unit}
            compact
            rows={d.localUnits
              .filter((u) => u.literacy !== null)
              .sort((a, b) => b.literacy! - a.literacy!)
              .map((u) => ({
                name: u.name,
                nameNe: u.nameNe,
                href: u.href,
                value: u.literacy!,
              }))}
          />
        </EditorialFigure>

        <div className="mt-8">
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
      </Chapter>

      {/* ------------------------------------------------------ 05 sources */}
      <Chapter
        n={5}
        title="Where this page comes from"
        standfirst="Only the datasets behind this page — two of six."
        action={{ href: "/datasets/", label: "All datasets" }}
      >
        <ul className="divide-line border-line divide-y border-t">
          {d.sources.map((s) => (
            <li key={s.dataset_id} className="py-5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-ink text-[15px] font-medium">{s.title}</p>
                <p className="text-ink-faint text-[12px]">{s.publisher}</p>
                <p className="text-ink-faint tabular ml-auto text-[12px]">
                  {s.licence} · retrieved {s.retrieved}
                </p>
              </div>
              {s.caveats.length > 0 && (
                <ul className="text-ink-soft mt-2 max-w-[70ch] list-disc space-y-1 pl-5 text-[12px] leading-relaxed">
                  {s.caveats.slice(0, 2).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Chapter>
    </EditorialShell>
  );
}
