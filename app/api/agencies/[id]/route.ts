import { addStatusHistory, getAgency, updateAgency } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { commercialStatuses, type Agency } from "@/lib/types";
import { publicAgency } from "@/lib/public";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agency = await getAgency(id);
  if (!agency) return Response.json({ error: "Agência não encontrada." }, { status: 404 });
  const user = await getAuthenticatedUserWithRole();
  return Response.json(user ? agency : publicAgency(agency), { headers: { "Cache-Control": user ? "private, max-age=20" : "public, max-age=60" } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  if (!["admin", "gestor", "vendedor"].includes(user.role)) return Response.json({ error: "Sem permissão para editar esta ficha." }, { status: 403 });
  const { id } = await params;
  const current = await getAgency(id);
  if (!current) return Response.json({ error: "Agência não encontrada." }, { status: 404 });
  const body = await request.json() as Partial<Agency>;
  if (body.commercialStatus && !commercialStatuses.includes(body.commercialStatus)) return Response.json({ error: "Status comercial inválido." }, { status: 400 });
  const item: Agency = { ...current, ...body, id, updatedAt: new Date().toISOString().slice(0, 10) };
  const saved = await updateAgency(id, item);
  if (body.commercialStatus && body.commercialStatus !== current.commercialStatus) {
    await addStatusHistory({ id: crypto.randomUUID(), agencyId: id, previousStatus: current.commercialStatus ?? "Não contatada", newStatus: body.commercialStatus, userEmail: user?.email ?? null, note: typeof body.notes === "string" ? body.notes : null, changedAt: new Date().toISOString() });
  }
  return Response.json(saved);
}
