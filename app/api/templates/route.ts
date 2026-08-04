import { deleteMessageTemplate, listMessageTemplates, saveMessageTemplate } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { templateCategories, type MessageTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

const canManage = (role: string) => role === "admin" || role === "gestor";
const clean = (value: unknown, max: number) => String(value ?? "").trim().replace(/[<>]/g, "").slice(0, max);

export async function GET() {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  return Response.json(await listMessageTemplates(canManage(user.role)), { headers: { "Cache-Control": "private, max-age=60" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!canManage(user.role)) return Response.json({ error: "Somente gestores podem gerenciar modelos." }, { status: 403 });
  const body = await request.json() as Partial<MessageTemplate>;
  const name = clean(body.name, 120); const content = clean(body.body, 2000);
  if (!name || !content || !body.category || !templateCategories.includes(body.category)) return Response.json({ error: "Nome, categoria e mensagem são obrigatórios." }, { status: 400 });
  const now = new Date().toISOString();
  const template: MessageTemplate = { id: crypto.randomUUID(), name, category: body.category, body: content, active: body.active !== false, createdBy: user.email, createdAt: now, updatedAt: now };
  return Response.json(await saveMessageTemplate(template), { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!canManage(user.role)) return Response.json({ error: "Somente gestores podem gerenciar modelos." }, { status: 403 });
  const body = await request.json() as Partial<MessageTemplate>;
  const id = clean(body.id, 80); const name = clean(body.name, 120); const content = clean(body.body, 2000);
  if (!id || !name || !content || !body.category || !templateCategories.includes(body.category)) return Response.json({ error: "Modelo incompleto." }, { status: 400 });
  const now = new Date().toISOString();
  const template: MessageTemplate = { id, name, category: body.category, body: content, active: body.active !== false, createdBy: body.createdBy ?? user.email, createdAt: body.createdAt ?? now, updatedAt: now };
  return Response.json(await saveMessageTemplate(template));
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!canManage(user.role)) return Response.json({ error: "Somente gestores podem gerenciar modelos." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Modelo obrigatório." }, { status: 400 });
  await deleteMessageTemplate(id);
  return Response.json({ ok: true });
}
