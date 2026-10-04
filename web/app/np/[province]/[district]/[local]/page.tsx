import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  allLocalUnitPaths,
  formatNumber,
  localUnitBySlug,
  placeBySlug,
  populationOf,
} from "@/lib/data";
import { editorialPlace, TYPE_NAME } from "@/lib/editorial";
import { PlacePage } from "@/components/editorial/PlacePage";

type Params = { province: string; district: string; local: string };

export async function generateStaticParams(): Promise<Params[]> {
  return allLocalUnitPaths();
}

async function resolve(params: Promise<Params>) {
  const { province, district, local } = await params;
  const prov = await placeBySlug("province", province);
  if (!prov) return null;
  const dist = await placeBySlug("district", district, prov.place_id);
  if (!dist) return null;
  const place = await localUnitBySlug(dist.place_id, local);
  if (!place) return null;
  return { prov, dist, place };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { prov, dist, place } = found;
  const label = TYPE_NAME[place.place_type] ?? "Local government";
  const pop = await populationOf(place);
  return {
    title: `${place.name_en} ${label}`,
    description: pop
      ? `${place.name_en} ${label}, ${dist.name_en} District, ${prov.name_en} Province: population ${formatNumber(pop.total)} at the 2021 census.`
      : `${place.name_en} ${label}, ${dist.name_en} District, ${prov.name_en} Province.`,
  };
}

const FRAME = { maxWidth: 760, maxHeight: 600 };

export default async function LocalUnitPage({ params }: { params: Promise<Params> }) {
  const found = await resolve(params);
  if (!found) notFound();
  return <PlacePage data={await editorialPlace(found.place, FRAME)} />;
}
