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

type Params = { province: string };

export async function generateStaticParams(): Promise<Params[]> {
  return (await provinces()).map((p) => ({ province: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { province } = await params;
  const place = await placeBySlug("province", province);
  if (!place) return {};
  const pop = await populationOf(place);
  const districts = await districtsOf(place.place_id);
  return {
    title: `${place.name_en} Province`,
    description: pop
      ? `${place.name_en} Province, Nepal: population ${formatNumber(pop.total)} (${pop.period}${pop.status === "actual" ? " census" : " projection"}), ${districts.length} districts, ${formatNumber(place.area_sqkm)} km².`
      : `${place.name_en} Province, Nepal.`,
  };
}

const FRAME = { maxWidth: 760, maxHeight: 600 };

export default async function ProvincePage({ params }: { params: Promise<Params> }) {
  const { province } = await params;
  const place = await placeBySlug("province", province);
  if (!place) notFound();
  return <PlacePage data={await editorialPlace(place, FRAME)} />;
}
