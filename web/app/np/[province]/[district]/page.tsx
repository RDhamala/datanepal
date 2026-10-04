import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  districtsOf,
  formatNumber,
  placeBySlug,
  populationOf,
  provinces,
} from "@/lib/data";
import { editorialPlace } from "@/lib/editorial";
import { PlacePage } from "@/components/editorial/PlacePage";

type Params = { province: string; district: string };

export async function generateStaticParams(): Promise<Params[]> {
  // From the parent relation, not a flat slug list: 22 local-unit names are
  // shared nationally, so slugs are unique only within a parent.
  const out: Params[] = [];
  for (const p of await provinces()) {
    for (const d of await districtsOf(p.place_id)) {
      out.push({ province: p.slug, district: d.slug });
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { province, district } = await params;
  const prov = await placeBySlug("province", province);
  const place = prov && (await placeBySlug("district", district, prov.place_id));
  if (!place || !prov) return {};
  const pop = await populationOf(place);
  return {
    title: `${place.name_en} District`,
    description: pop
      ? `${place.name_en} District, ${prov.name_en} Province, Nepal: population ${formatNumber(pop.total)} (${pop.period}${pop.status === "actual" ? " census" : " projection"}), ${formatNumber(place.area_sqkm)} km².`
      : `${place.name_en} District, ${prov.name_en} Province, Nepal.`,
  };
}

const FRAME = { maxWidth: 760, maxHeight: 600 };

export default async function DistrictPage({ params }: { params: Promise<Params> }) {
  const { province, district } = await params;
  const prov = await placeBySlug("province", province);
  if (!prov) notFound();
  const place = await placeBySlug("district", district, prov.place_id);
  if (!place) notFound();
  return <PlacePage data={await editorialPlace(place, FRAME)} />;
}
