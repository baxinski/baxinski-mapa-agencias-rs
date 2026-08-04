import { getAuthenticatedUserWithRole } from "@/app/auth";
import { listAgencies, listAllContacts, listTasks } from "@/db";
import { normalizeAccompanimentPriority, normalizeAccompanimentStatus, toAccompanimentAgency } from "@/lib/followup";
import { regionForCity } from "@/lib/regional";
import { activeTourismAgencies } from "@/lib/tourism";
import { accompanimentStatuses, type AccompanimentAgency, type AccompanimentResponse, type Agency } from "@/lib/types";

export const dynamic = "force-dynamic";

function dateKey(value: string | Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

function tourismAgency(source: (typeof activeTourismAgencies)[number]): Agency {
  return {
    id: `tourism:${source.id}`, slug: `turismo-${source.id}`, legalName: source.legalName,
    tradeName: source.tradeName === "*" ? source.legalName ?? "Agência sem nome divulgado" : source.tradeName,
    city: source.city, region: regionForCity(source.city), state: source.state,
    neighborhood: source.neighborhood, cep: source.cep, address: source.address, phone: source.phone,
    email: null, website: source.website, instagram: null, linkedin: null, directors: null, owners: null,
    commercialManager: null, exchangeLead: null, programs: [source.activity], belta: null, units: 1,
    audienceProfile: "Agência de turismo cadastrada no Cadastur", commercialPotential: "C", notes: null,
    verificationStatus: "Verificado", sourceUrl: source.sourceUrl, sourceLabel: source.sourceLabel,
    verifiedAt: source.verifiedAt, updatedAt: source.verifiedAt, commercialStatus: "Não contatada",
    accompanimentStatus: "Não analisada", accompanimentPriority: "Sem prioridade definida", assignedTo: null,
    primaryContactName: null, primaryContactRole: null, nextAction: null, whatsapp: null, facebook: null,
    network: null, destinations: [], exchangeTypes: [], description: source.activity, hours: null,
  };
}

function effectiveStatus(agency: Agency, contacts: ReturnType<typeof listAllContacts> extends Promise<infer T> ? T[number][] : never, tasks: ReturnType<typeof listTasks> extends Promise<infer T> ? T[number][] : never) {
  const explicit = normalizeAccompanimentStatus(agency.accompanimentStatus);
  if (explicit !== "Não analisada") return explicit;
  const open = tasks.filter((task) => task.status === "Aberta");
  if (open.some((task) => task.activityType === "Visita")) return "Visita planejada" as const;
  if (open.some((task) => task.activityType === "Reunião")) return "Reunião agendada" as const;
  const latest = contacts[0];
  return latest ? latest.nextContactAt ? "Aguardando retorno" as const : "Contato realizado" as const : explicit;
}

export async function GET() {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  const [stored, contacts, tasks] = await Promise.all([listAgencies(), listAllContacts(), listTasks()]);
  const storedById = new Map(stored.map((agency) => [agency.id, agency]));
  const records: AccompanimentAgency[] = [];
  const sources = [
    ...stored.filter((agency) => !agency.id.startsWith("tourism:")).map((agency) => ({ agency, kind: "exchange" as const })),
    ...activeTourismAgencies.map((source) => ({ agency: storedById.get(`tourism:${source.id}`) ?? tourismAgency(source), kind: "tourism" as const })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  for (const { agency, kind } of sources) {
    const agencyContacts = contacts.filter((contact) => contact.agencyId === agency.id).sort((a, b) => `${b.contactDate} ${b.createdAt}`.localeCompare(`${a.contactDate} ${a.createdAt}`));
    const agencyTasks = tasks.filter((task) => task.agencyId === agency.id);
    const openTasks = agencyTasks.filter((task) => task.status === "Aberta");
    const overdueTasks = openTasks.filter((task) => dateKey(task.dueAt) !== null && (dateKey(task.dueAt) as string) < today);
    const item = toAccompanimentAgency({ ...agency, accompanimentStatus: effectiveStatus(agency, agencyContacts, openTasks) }, kind, {
      openTaskCount: openTasks.length,
      overdueTaskCount: overdueTasks.length,
      lastContactAt: agencyContacts[0]?.contactDate ?? agency.lastContactAt ?? null,
      nextContactAt: agencyContacts[0]?.nextContactAt ?? openTasks.sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt ?? agency.nextFollowUpAt ?? null,
    });
    records.push(item);
  }
  records.sort((a, b) => a.tradeName.localeCompare(b.tradeName, "pt-BR"));
  const by = (predicate: (item: AccompanimentAgency) => boolean) => records.filter(predicate).length;
  const metrics: AccompanimentResponse["metrics"] = {
    total: records.length, notAnalyzed: by((item) => item.accompanimentStatus === "Não analisada"),
    incomplete: by((item) => item.completeness < 100 || item.accompanimentStatus === "Dados incompletos"),
    ready: by((item) => item.accompanimentStatus === "Pronta para contato"),
    contacted: by((item) => ["Contato realizado", "Relacionamento ativo", "Reunião agendada", "Visita planejada", "Visita realizada", "Aguardando retorno"].includes(item.accompanimentStatus ?? "")),
    awaitingReply: by((item) => item.accompanimentStatus === "Aguardando retorno"),
    meetings: by((item) => item.accompanimentStatus === "Reunião agendada"),
    visitsPlanned: by((item) => item.accompanimentStatus === "Visita planejada"),
    overdue: records.reduce((sum, item) => sum + item.overdueTaskCount, 0),
  };
  const filters = {
    cities: [...new Set(records.map((item) => item.city))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    regions: [...new Set(records.map((item) => item.region))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    owners: [...new Set(records.map((item) => item.internalOwner).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
  return Response.json({ agencies: records, tasks, metrics, filters } satisfies AccompanimentResponse, { headers: { "Cache-Control": "private, max-age=20" } });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (user.role === "consulta") return Response.json({ error: "Seu perfil permite apenas consulta." }, { status: 403 });
  const body = await request.json() as { agencyId?: string; accompanimentStatus?: string; accompanimentPriority?: string; internalOwner?: string | null; primaryContactName?: string | null; primaryContactRole?: string | null; nextAction?: string | null };
  if (!body.agencyId) return Response.json({ error: "Agência obrigatória." }, { status: 400 });
  const current = await (await import("@/db")).getAgency(body.agencyId);
  if (!current) return Response.json({ error: "Agência não encontrada na base de acompanhamento." }, { status: 404 });
  const allowedStatus = body.accompanimentStatus && (accompanimentStatuses as readonly string[]).includes(body.accompanimentStatus) ? body.accompanimentStatus as AccompanimentAgency["accompanimentStatus"] : current.accompanimentStatus;
  const allowedPriority = body.accompanimentPriority ? normalizeAccompanimentPriority(body.accompanimentPriority) : current.accompanimentPriority;
  const saved = await (await import("@/db")).updateAgency(body.agencyId, { ...current, accompanimentStatus: allowedStatus, accompanimentPriority: allowedPriority, assignedTo: body.internalOwner ?? current.assignedTo, primaryContactName: body.primaryContactName ?? current.primaryContactName, primaryContactRole: body.primaryContactRole ?? current.primaryContactRole, nextAction: body.nextAction ?? current.nextAction, updatedAt: new Date().toISOString().slice(0, 10) });
  return Response.json(saved);
}

