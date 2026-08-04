import { notFound } from "next/navigation";
import TourismDetail from "@/app/components/TourismDetail";
import { activeTourismAgencies } from "@/lib/tourism";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agency = activeTourismAgencies.find((item) => item.id === id);
  return { title: agency ? `${agency.tradeName} · Agência de turismo` : "Agência de turismo" };
}

export default async function TourismAgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agency = activeTourismAgencies.find((item) => item.id === id);
  if (!agency) notFound();
  return <main className="detail-page"><TourismDetail agency={agency} /></main>;
}
