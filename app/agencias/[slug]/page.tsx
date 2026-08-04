import AgencyDetail from "@/app/components/AgencyDetail";

export default async function AgencyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="detail-page"><AgencyDetail slug={slug} /></main>;
}
