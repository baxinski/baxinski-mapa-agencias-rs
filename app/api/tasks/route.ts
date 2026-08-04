import { addContact, addTask, listTasks, updateTask } from "@/db";
import { getAuthenticatedUser } from "@/app/auth";
import type { TaskPriority, TaskRecord, TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const priorities: TaskPriority[] = ["Baixa", "Média", "Alta", "Urgente"];
const statuses: TaskStatus[] = ["Aberta", "Concluída", "Cancelada"];

export async function GET() {
  return Response.json(await listTasks());
}

export async function POST(request: Request) {
  if (!(await getAuthenticatedUser())) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  const body = await request.json() as Partial<TaskRecord>;
  if (!body.agencyId || !body.title || !body.dueAt) return Response.json({ error: "Agência, título e data são obrigatórios." }, { status: 400 });
  if (body.priority && !priorities.includes(body.priority)) return Response.json({ error: "Prioridade inválida." }, { status: 400 });
  const user = await getAuthenticatedUser();
  const task: TaskRecord = {
    id: crypto.randomUUID(), agencyId: body.agencyId, title: body.title, description: body.description ?? null,
    assignedTo: body.assignedTo ?? user?.email ?? null, dueAt: body.dueAt, priority: body.priority ?? "Média",
    status: body.status ?? "Aberta", activityType: body.activityType ?? "Follow-up", notes: body.notes ?? null,
    completedAt: null, createdAt: new Date().toISOString(), createdBy: user?.email ?? null,
  };
  return Response.json(await addTask(task), { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await getAuthenticatedUser())) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  const body = await request.json() as { id?: string; status?: TaskStatus };
  if (!body.id || !body.status || !statuses.includes(body.status)) return Response.json({ error: "Tarefa e status válidos são obrigatórios." }, { status: 400 });
  const completedAt = body.status === "Concluída" ? new Date().toISOString() : null;
  const task = await updateTask(body.id, body.status, completedAt);
  if (!task) return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
  if (body.status === "Concluída") {
    const user = await getAuthenticatedUser();
    await addContact({ id: crypto.randomUUID(), agencyId: task.agencyId, contactDate: new Date().toISOString().slice(0, 10), contactTime: new Date().toISOString().slice(11, 16), channel: task.activityType, interactionType: task.activityType, contactName: null, summary: `Tarefa concluída: ${task.title}`, result: "Concluída", nextStep: null, nextContactAt: null, createdBy: user?.email ?? null, createdAt: new Date().toISOString() });
  }
  return Response.json(task);
}
