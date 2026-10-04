import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { country } from "@/lib/data";
import { editorialPlace } from "@/lib/editorial";
import { PlacePage } from "@/components/editorial/PlacePage";

export const metadata: Metadata = {
  title: "Nepal",
  description:
    "Nepal in data: population, education, economy, government, health and more, " +
    "with the provinces, districts and local governments beneath.",
};

const FRAME = { maxWidth: 760, maxHeight: 600 };

export default async function NepalPage() {
  const np = await country();
  if (!np) notFound();
  return <PlacePage data={await editorialPlace(np, FRAME)} />;
}
