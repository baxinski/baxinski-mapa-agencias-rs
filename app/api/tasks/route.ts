import { addContact, addTask, getAgency, listTasks, saveAgency, updateTask } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { regionForCity } from "@/lib/regional";
import { activeTourismAgencies } from "@/lib/tourism";
import { commercialStatuses, type Agency, type TaskPriority, type TaskRecord, type TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const priorities: TaskPriority[] = ["Baixa", "Média", "Alta", "Urgente"];
const statuses: TaskStatus[] = ["Aberta", "Concluída", "Cancelada"];

async function resolveAgencyId(value: string) {
  if (!value.startsWith("tourism:")) return value;
  const sourceId = value.slice("tourism:".length);
  const source = activeTourismAgencies.find((agency) => agency.id === sourceId);
  if (!source) throw new Error("Agência de turismo não encontrada na base ativa.");

  const existing = await getAgency(value);
  if (existing) return value;

  const now = new Date().toISOString().slice(0, 10);
  const item: Agency = {
    id: value,
    slug: `turismo-${source.id}`,
    legalName: source.legalName,
    tradeName: source.tradeName === "*" ? source.legalName ?? "Agência sem nome divulgado" : source.tradeName,
    city: source.city,
    region: regionForCity(source.city),
    state: source.state,
    neighborhood: source.neighborhood,
    cep: source.cep,
    address: source.address,
    phone: source.phone,
    email: null,
    website: source.website,
    instagram: null,
    linkedin: null,
    directors: null,
    owners: null,
    commercialManager: null,
    exchangeLead: null,
    programs: [source.activity],
    belta: null,
    units: 1,
    audienceProfile: "Agência de turismo cadastrada no Cadastur",
    commercialPotential: "C",
    commercialStatus: commercialStatuses[0],
    notes: null,
    verificationStatus: "Verificado",
    sourceUrl: source.sourceUrl,
    sourceLabel: source.sourceLabel,
    verifiedAt: source.verifiedAt,
    updatedAt: now,
    whatsapp: null,
    facebook: null,
    network: null,
    destinations: [],
    exchangeTypes: [],
    description: source.activity,
    hours: null,
  };
  await saveAgency(item);
  return value;
}

export async function GET() {
  if (!(await getAuthenticatedUserWithRole())) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  return Response.json(await listTasks());
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (user.role === "consulta") return Response.json({ error: "Seu perfil permite apenas consulta." }, { status: 403 });
  const body = await request.json() as Partial<TaskRecord>;
  if (!body.agencyId || !body.title || !body.dueAt) return Response.json({ error: "Agência, título e data são obrigatórios." }, { status: 400 });
  if (body.priority && !priorities.includes(body.priority)) return Response.json({ error: "Prioridade inválida." }, { status: 400 });

  let agencyId: string;
  try {
    agencyId = await resolveAgencyId(body.agencyId);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agência inválida." }, { status: 400 });
  }

  const task: TaskRecord = {
    id: crypto.randomUUID(), agencyId, title: body.title, description: body.description ?? null,
    assignedTo: body.assignedTo ?? user.email ?? null, dueAt: body.dueAt, priority: body.priority ?? "Média",
    status: body.status ?? "Aberta", activityType: body.activityType ?? "Follow-up", notes: body.notes ?? null,
    completedAt: null, createdAt: new Date().toISOString(), createdBy: user.email ?? null,
  };
  return Response.json(await addTask(task), { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (user.role === "consulta") return Response.json({ error: "Seu perfil permite apenas consulta." }, { status: 403 });
  const body = await request.json() as { id?: string; status?: TaskStatus };
  if (!body.id || !body.status || !statuses.includes(body.status)) return Response.json({ error: "Tarefa e status válidos são obrigatórios." }, { status: 400 });
  const completedAt = body.status === "Concluída" ? new Date().toISOString() : null;
  const task = await updateTask(body.id, body.status, completedAt);
  if (!task) return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
  if (body.status === "Concluída") {
    await addContact({ id: crypto.randomUUID(), agencyId: task.agencyId, contactDate: new Date().toISOString().slice(0, 10), contactTime: new Date().toISOString().slice(11, 16), channel: task.activityType, interactionType: task.activityType, contactName: null, summary: `Tarefa concluída: ${task.title}`, result: "Concluída", nextStep: null, nextContactAt: null, createdBy: user.email ?? null, createdAt: new Date().toISOString() });
  }
  return Response.json(task);
}
