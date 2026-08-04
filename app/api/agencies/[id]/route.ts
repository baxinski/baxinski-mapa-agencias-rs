import { addStatusHistory, getAgency, updateAgency } from "@/db";
import { getAuthenticatedUser } from "@/app/auth";
import { commercialStatuses, type Agency } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agency = await getAgency(id);
  return agency ? Response.json(agency) : Response.json({ error: "Agência não encontrada." }, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAuthenticatedUser())) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  const { id } = await params;
  const current = await getAgency(id);
  if (!current) return Response.json({ error: "Agência não encontrada." }, { status: 404 });
  const body = await request.json() as Partial<Agency>;
  if (body.commercialStatus && !commercialStatuses.includes(body.commercialStatus)) return Response.json({ error: "Status comercial inválido." }, { status: 400 });
  const item: Agency = { ...current, ...body, id, updatedAt: new Date().toISOString().slice(0, 10) };
  const saved = await updateAgency(id, item);
  if (body.commercialStatus && body.commercialStatus !== current.commercialStatus) {
    const user = await getAuthenticatedUser();
    await addStatusHistory({ id: crypto.randomUUID(), agencyId: id, previousStatus: current.commercialStatus ?? "Não contatada", newStatus: body.commercialStatus, userEmail: user?.email ?? null, note: typeof body.notes === "string" ? body.notes : null, changedAt: new Date().toISOString() });
  }
  return Response.json(saved);
}
