import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dhadingProfile } from "@/lib/editorial";
import {
  AtlasShell,
  BenchmarkStack,
  MetricRow,
  Panel,
} from "@/components/design-reset/atlas";
import { AtlasMap } from "@/components/design-reset/AtlasMap";
import {
  ordinal,
  PrototypeBar,
  prototypeRobots,
} from "@/components/design-reset/shared";
import { AgePyramid } from "@/components/AgePyramid";
import { DataDisclosure, DataGrid } from "@/components/viz/DataDisclosure";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Direction B — Atlas · Dhading District",
  robots: prototypeRobots,
};

/* Direction B, Dhading. The 13 local governments are the page's spine. */
export default async function AtlasDhading() {
  const d = await dhadingProfile({ maxWidth: 980, maxHeight: 620 });
  if (!d) notFound();

  const pop = d.population;
  const literacy = d.literacy;
  const female = d.literacyBySex.find((s) => s.sex === "female");
  const male = d.literacyBySex.find((s) => s.sex === "male");
  const maxBreakdown = Math.max(...d.literacyBreakdown.map((r) => r.all), 1);

  // Explicit null checks: `value && {...}` collapses a real 0 into a falsy.
  const facts: { k: string; v: string; n: string }[] = [];
  if (pop)
    facts.push({
      k: "Population",
      v: formatNumber(pop.total),
      n: `${pop.period} census`,
    });
  if (d.households)
    facts.push({
      k: "Households",
      v: formatNumber(d.households.value),
      n: "2021 census",
    });
  if (d.areaSqKm !== null)
    facts.push({
      k: "Area",
      v: `${formatNumber(Math.round(d.areaSqKm))} km²`,
      n: "COD boundaries",
    });
  if (d.density !== null)
    facts.push({ k: "Density", v: `${d.density.toFixed(0)}/km²`, n: "Derived" });
  if (literacy)
    facts.push({
      k: "Literacy",
      v: `${literacy.value.toFixed(1)}%`,
      n: d.literacyRank
        ? `${ordinal(d.literacyRank.rank)} of ${d.literacyRank.of}`
        : "2021 census",
    });

  return (
    <AtlasShell>
      <PrototypeBar
        direction="B — Geographic Civic Atlas"
        other="/design-reset/editorial/dhading/"
        otherLabel="See Direction A"
      />

      <div className="max-w-wide mx-auto space-y-6 px-5 py-6 sm:px-8">
        {/* --------------------------------------------------- identity bar */}
        <div>
          <nav aria-label="Breadcrumb" className="text-ink-faint mb-3 text-[12px]">
            <Link href="/np/">Nepal</Link>
            <span className="mx-1.5">›</span>
            <Link href={`/np/${d.parent?.slug ?? ""}/`}>{d.parent?.name_en}</Link>
            <span className="mx-1.5">›</span>
            <span className="text-ink-soft">{d.place.name_en}</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <h1 className="text-ink text-[clamp(2rem,1.6rem+1.8vw,2.75rem)] leading-none font-semibold tracking-[-0.035em]">
                {d.place.name_en} District
              </h1>
              <p className="text-ink-faint mt-2 text-[12px]">
                {d.parent?.name_en} Province
                {d.parent?.name_ne && (
                  <span className="ne ml-1.5" lang="ne">
                    {d.parent.name_ne}
                  </span>
                )}{" "}
                · {d.place.ocha_pcode} · no Nepali name published for any district
              </p>
            </div>
            <Link
              href="/compare/"
              className="border-line bg-surface hover:border-line-strong rounded-md border px-3 py-2 text-[13px] no-underline"
            >
              Compare with other places →
            </Link>
          </div>
        </div>

        {/* ------------------------------------------------------ fact strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {facts.map((f) => (
            <div
              key={f.k}
              className="bg-surface border-line rounded-lg border px-4 py-3"
            >
              <p className="text-ink-faint text-[11px]">{f.k}</p>
              <p className="text-ink tabular mt-1.5 text-[22px] leading-none font-semibold tracking-[-0.03em]">
                {f.v}
              </p>
              <p className="text-ink-faint mt-1.5 text-[10px]">{f.n}</p>
            </div>
          ))}
        </div>

        {/* ------------------------------- the map: this page's main surface */}
        <Panel
          label="Local governments"
          title={`${d.localUnits.length} places inside Dhading`}
          action={{ href: "/places/", label: "All places" }}
        >
          {d.localMap && (
            <AtlasMap
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
            />
          )}

          <div className="mt-5">
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
        </Panel>

        {/* ------------------------------------------ population + benchmark */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
          {pop && pop.bands.length > 0 && (
            <Panel label={`${pop.bandPeriod} projection`} title="Age and sex">
              <AgePyramid bands={pop.bands} period={pop.bandPeriod ?? pop.period} />
              <p className="text-ink-faint mt-3 text-[11px]">
                UNFPA projection — a different reference period from the {pop.period}{" "}
                census count above.
              </p>
            </Panel>
          )}

          <div className="space-y-6">
            {literacy && (
              <Panel label="Benchmark" title="Literacy, in context">
                <BenchmarkStack rows={d.literacyBenchmarks} />
                {d.literacyRank && (
                  <p className="text-ink-soft mt-4 text-[13px] leading-relaxed">
                    {ordinal(d.literacyRank.rank)} of {d.literacyRank.of} districts.{" "}
                    {d.literacyRank.top} leads; {d.literacyRank.bottom} is last.
                  </p>
                )}
                {female && male && (
                  <div className="border-line mt-4 border-t pt-3">
                    <MetricRow
                      label="Men"
                      value={male.value}
                      display={`${male.value.toFixed(1)}%`}
                      max={100}
                    />
                    <MetricRow
                      label="Women"
                      value={female.value}
                      display={`${female.value.toFixed(1)}%`}
                      max={100}
                    />
                    <p className="text-ink-faint mt-2 text-[11px]">
                      {(male.value - female.value).toFixed(1)}-point gap.
                    </p>
                  </div>
                )}
              </Panel>
            )}

            {pop?.laterEstimate && (
              <Panel label="Two reference periods" title="Count and projection">
                <div className="space-y-3">
                  <div>
                    <p className="text-ink tabular text-[24px] leading-none font-semibold">
                      {formatNumber(pop.total)}
                    </p>
                    <p className="text-ink-faint mt-1 text-[11px]">
                      {pop.period} census — enumerated
                    </p>
                  </div>
                  <div className="border-line border-t pt-3">
                    <p className="text-ink-soft tabular text-[24px] leading-none font-semibold">
                      {formatNumber(pop.laterEstimate.value)}
                    </p>
                    <p className="text-ink-faint mt-1 text-[11px]">
                      {pop.laterEstimate.period} projection — modelled
                    </p>
                  </div>
                </div>
                <p className="text-ink-faint mt-3 text-[11px] leading-relaxed">
                  Never mixed: dividing the projection by census households gives a
                  household size that is wrong.
                </p>
              </Panel>
            )}
          </div>
        </div>

        {/* ----------------------------------------------- literacy partition */}
        {d.literacyBreakdown.length > 0 && (
          <Panel
            label="2021 census"
            title="Population aged 5 and over, by literacy status"
          >
            <div className="max-w-2xl">
              {d.literacyBreakdown.map((r) => (
                <MetricRow
                  key={r.label}
                  label={r.label}
                  value={r.all}
                  display={formatNumber(r.all)}
                  max={maxBreakdown}
                />
              ))}
            </div>
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
          </Panel>
        )}

        {/* ---------------------------------------------------------- sources */}
        <Panel
          label="Provenance"
          title="Sources for this page"
          action={{ href: "/datasets/", label: "All datasets" }}
        >
          <ul className="divide-line divide-y">
            {d.sources.map((s) => (
              <li
                key={s.dataset_id}
                className="flex flex-wrap items-baseline gap-x-3 py-2.5"
              >
                <span className="text-ink text-[14px]">{s.title}</span>
                <span className="text-ink-faint text-[12px]">{s.publisher}</span>
                <span className="text-ink-faint tabular ml-auto text-[11px]">
                  {s.licence} · {s.retrieved}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AtlasShell>
  );
}
