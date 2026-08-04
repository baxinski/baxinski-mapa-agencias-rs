import { addContact, listContacts } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { ensureTourismShadowAgency } from "@/lib/followup";
import type { ContactRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  const agencyId = new URL(request.url).searchParams.get("agencyId");
  if (!agencyId) return Response.json({ error: "agencyId obrigatório." }, { status: 400 });
  return Response.json(await listContacts(agencyId));
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (user.role === "consulta") return Response.json({ error: "Seu perfil permite apenas consulta." }, { status: 403 });
  const body = await request.json() as Partial<ContactRecord>;
  if (!body.agencyId || !body.summary) return Response.json({ error: "Agência e resumo são obrigatórios." }, { status: 400 });
  let agencyId: string;
  try { agencyId = await ensureTourismShadowAgency(body.agencyId); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Agência inválida." }, { status: 400 }); }
  const contact: ContactRecord = {
    id: crypto.randomUUID(), agencyId,
    contactDate: body.contactDate ?? new Date().toISOString().slice(0, 10), contactTime: body.contactTime ?? new Date().toISOString().slice(11, 16),
    channel: body.channel ?? "Telefone", interactionType: body.interactionType ?? body.channel ?? "Contato",
    contactName: body.contactName ?? null, summary: body.summary, result: body.result ?? null,
    nextStep: body.nextStep ?? null, nextContactAt: body.nextContactAt ?? null, createdBy: user?.email ?? null,
    contactRole: body.contactRole ?? null, subject: body.subject ?? null, informationObtained: body.informationObtained ?? null,
    createdAt: new Date().toISOString(),
  };
  const created = await addContact(contact);
  return Response.json(created, { status: 201 });
}

