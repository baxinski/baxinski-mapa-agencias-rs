import { getAuthenticatedUserWithRole } from "@/app/auth";
import { listAgencyPlans, listAgencySubscriptions, saveAgencyPlan, saveAgencySubscription } from "@/db";
import type { AgencyPlan, AgencySubscription } from "@/lib/types";

export const dynamic = "force-dynamic";

const subscriptionStatuses: AgencySubscription["status"][] = ["trial", "active", "paused", "cancelled"];

export async function GET() {
  const user = await getAuthenticatedUserWithRole();
  const plans = await listAgencyPlans(Boolean(user && ["admin", "gestor"].includes(user.role)));
  if (!user || !["admin", "gestor"].includes(user.role)) return Response.json(plans, { headers: { "Cache-Control": "public, max-age=300" } });
  return Response.json({ plans, subscriptions: await listAgencySubscriptions() });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserWithRole();
  if (!user || !["admin", "gestor"].includes(user.role)) return Response.json({ error: "Sem permissão para configurar planos." }, { status: 403 });
  const body = await request.json() as Partial<AgencyPlan & AgencySubscription> & { kind?: "plan" | "subscription" };
  const now = new Date().toISOString();
  if (body.kind === "subscription") {
    if (!body.agencyId || !body.planId || !body.status || !subscriptionStatuses.includes(body.status)) return Response.json({ error: "Agência, plano e status são obrigatórios." }, { status: 400 });
    const subscription: AgencySubscription = { id: body.id ?? crypto.randomUUID(), agencyId: body.agencyId, planId: body.planId, status: body.status, startedAt: body.startedAt ?? now.slice(0, 10), endsAt: body.endsAt ?? null, externalCustomerId: body.externalCustomerId ?? null, createdAt: body.createdAt ?? now, updatedAt: now };
    return Response.json(await saveAgencySubscription(subscription), { status: 201 });
  }
  const code = body.code;
  if (!body.name || !body.description || !code || !["basico", "verificado", "regional", "leads"].includes(code)) return Response.json({ error: "Código, nome e descrição do plano são obrigatórios." }, { status: 400 });
  const plan: AgencyPlan = { id: body.id ?? `plan-${code}`, code, name: body.name, description: body.description, monthlyPrice: body.monthlyPrice ?? null, features: body.features ?? [], active: body.active !== false, createdAt: body.createdAt ?? now, updatedAt: now };
  return Response.json(await saveAgencyPlan(plan), { status: 201 });
}
