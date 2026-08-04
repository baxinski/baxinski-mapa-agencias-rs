import { listAgencies } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { regionForCity } from "@/lib/regional";
import { activeTourismAgencies } from "@/lib/tourism";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAuthenticatedUserWithRole())) {
    return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const exchangeAgencies = await listAgencies();
  const agencies = [
    ...exchangeAgencies.map((agency) => ({
      id: agency.id,
      tradeName: agency.tradeName,
      city: agency.city,
      region: agency.region,
      kind: "exchange" as const,
    })),
    ...activeTourismAgencies.map((agency) => ({
      id: `tourism:${agency.id}`,
      tradeName: agency.tradeName === "*" ? agency.legalName ?? "Agência sem nome divulgado" : agency.tradeName,
      city: agency.city,
      region: regionForCity(agency.city),
      kind: "tourism" as const,
    })),
  ].sort((a, b) => a.tradeName.localeCompare(b.tradeName, "pt-BR"));

  return Response.json({ agencies, counts: { exchange: exchangeAgencies.length, tourism: activeTourismAgencies.length } }, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}
