import { listAgencies, saveAgency } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { publicAgencyList } from "@/lib/public";
import type { Agency } from "@/lib/types";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  const agencies = await listAgencies();
  const user = await getAuthenticatedUserWithRole();
  return Response.json(user ? agencies : publicAgencyList(agencies), { headers: { "Cache-Control": user ? "private, max-age=20" : "public, max-age=60" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!["admin", "gestor"].includes(user.role)) return Response.json({ error: "Sem permissão para cadastrar agências." }, { status: 403 });
  const body = await request.json() as Partial<Agency>;
  if (!body.tradeName || !body.city || !body.region) return Response.json({ error: "Nome, cidade e região são obrigatórios." }, { status: 400 });
  const now = new Date().toISOString().slice(0, 10);
  const item: Agency = {
    id: crypto.randomUUID(), slug: slugify(body.tradeName), legalName: body.legalName ?? null,
    tradeName: body.tradeName, city: body.city, region: body.region, address: body.address ?? null,
    phone: body.phone ?? null, email: body.email ?? null, website: body.website ?? null,
    instagram: body.instagram ?? null, linkedin: body.linkedin ?? null, state: body.state ?? "RS", neighborhood: body.neighborhood ?? null, cep: body.cep ?? null, whatsapp: body.whatsapp ?? null, facebook: body.facebook ?? null, network: body.network ?? null, directors: body.directors ?? null,
    owners: body.owners ?? null, commercialManager: body.commercialManager ?? null,
    exchangeLead: body.exchangeLead ?? null, programs: body.programs ?? [], belta: body.belta ?? null,
    units: Number(body.units ?? 1), audienceProfile: body.audienceProfile ?? "Não classificado", destinations: body.destinations ?? [], exchangeTypes: body.exchangeTypes ?? [], description: body.description ?? null, hours: body.hours ?? null, logoUrl: body.logoUrl ?? null, competitors: body.competitors ?? null, productsOfInterest: body.productsOfInterest ?? null, needs: body.needs ?? null,
    commercialPotential: body.commercialPotential ?? "C", commercialStatus: body.commercialStatus ?? "Não contatada", accompanimentStatus: body.accompanimentStatus ?? "Não analisada", accompanimentPriority: body.accompanimentPriority ?? "Sem prioridade definida", assignedTo: body.internalOwner ?? body.assignedTo ?? null, internalOwner: body.internalOwner ?? body.assignedTo ?? null, primaryContactName: body.primaryContactName ?? null, primaryContactRole: body.primaryContactRole ?? null, nextAction: body.nextAction ?? null, estimatedValue: body.estimatedValue ?? null, googleRating: body.googleRating ?? null, googleReviewCount: body.googleReviewCount ?? null, isFranchise: body.isFranchise ?? null, notes: body.notes ?? null,
    verificationStatus: body.verificationStatus ?? "Revisar", sourceUrl: body.sourceUrl ?? null,
    sourceLabel: body.sourceLabel ?? null, verifiedAt: body.verifiedAt ?? null, updatedAt: now,
  };
  return Response.json(await saveAgency(item), { status: 201 });
}

