import { addLead, listAgencies, listLeads, updateLead } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { publicAgency } from "@/lib/public";
import type { Agency, LeadRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 240) {
  return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, max);
}

function digits(value: string) { return value.replace(/\D/g, ""); }

function matchesLead(agency: Agency, lead: Pick<LeadRecord, "city" | "destination" | "exchangeType">) {
  const city = lead.city.toLocaleLowerCase("pt-BR");
  const destination = lead.destination.toLocaleLowerCase("pt-BR");
  const exchangeType = lead.exchangeType.toLocaleLowerCase("pt-BR");
  const destinations = (agency.destinations ?? []).join(" ").toLocaleLowerCase("pt-BR");
  const types = [...(agency.exchangeTypes ?? []), ...(agency.programs ?? [])].join(" ").toLocaleLowerCase("pt-BR");
  let score = 0;
  if (agency.city.toLocaleLowerCase("pt-BR") === city) score += 5;
  if (destinations.includes(destination) || destination.includes(agency.city.toLocaleLowerCase("pt-BR"))) score += 3;
  if (types.includes(exchangeType)) score += 3;
  if (agency.website) score += 1;
  if (agency.phone || agency.whatsapp) score += 1;
  return score;
}

export async function GET() {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!["admin", "gestor", "vendedor"].includes(user.role)) return Response.json({ error: "Sem permissão para consultar leads." }, { status: 403 });
  return Response.json(await listLeads(), { headers: { "Cache-Control": "private, max-age=15" } });
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const name = clean(body.name, 100);
  const whatsapp = clean(body.whatsapp, 40);
  const email = clean(body.email, 160).toLowerCase();
  const city = clean(body.city, 100);
  const destination = clean(body.destination, 100);
  const exchangeType = clean(body.exchangeType, 120);
  const consent = body.consent === true;
  if (name.length < 2 || digits(whatsapp).length < 8 || !email.includes("@") || !city || !destination || !exchangeType || !consent) {
    return Response.json({ error: "Preencha os campos obrigatórios e autorize o contato." }, { status: 400 });
  }
  const agencies = await listAgencies();
  const matches = agencies.map((agency) => ({ agency, score: matchesLead(agency, { city, destination, exchangeType }) }))
    .filter((item) => item.score > 0).sort((a, b) => b.score - a.score || (b.agency.opportunityScore ?? 0) - (a.agency.opportunityScore ?? 0)).slice(0, 6).map((item) => item.agency);
  const now = new Date().toISOString();
  const parsedAge = Number(body.travelerAge);
  const lead: LeadRecord = {
    id: crypto.randomUUID(), name, whatsapp, email, city, destination, exchangeType,
    budgetRange: clean(body.budgetRange, 80) || null, travelDate: clean(body.travelDate, 40) || null,
    duration: clean(body.duration, 60) || null, travelerAge: body.travelerAge && Number.isFinite(parsedAge) ? Math.max(0, Math.min(120, parsedAge)) : null,
    notes: clean(body.notes, 800) || null, consent, source: clean(body.source, 80) || "public-form",
    status: "Novo", assignedTo: null, matchedAgencyIds: matches.map((agency) => agency.id), createdAt: now, updatedAt: now,
  };
  await addLead(lead);
  return Response.json({ leadId: lead.id, matches: matches.map(publicAgency) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!["admin", "gestor", "vendedor"].includes(user.role)) return Response.json({ error: "Sem permissão para editar leads." }, { status: 403 });
  const body = await request.json() as { id?: string; status?: LeadRecord["status"]; assignedTo?: string | null };
  const statuses: LeadRecord["status"][] = ["Novo", "Em atendimento", "Distribuído", "Convertido", "Arquivado"];
  if (!body.id || !body.status || !statuses.includes(body.status)) return Response.json({ error: "Lead e status válidos são obrigatórios." }, { status: 400 });
  const lead = await updateLead(body.id, { status: body.status, assignedTo: body.assignedTo ?? user.email });
  return lead ? Response.json(lead) : Response.json({ error: "Lead não encontrado." }, { status: 404 });
}
