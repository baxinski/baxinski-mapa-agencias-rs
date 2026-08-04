import { addAnalyticsEvent } from "@/db";
import { getAuthenticatedUser } from "@/app/auth";
import { analyticsEventNames, type AnalyticsEventName } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json() as { name?: AnalyticsEventName; path?: string; agencyId?: string; metadata?: Record<string, string | number | boolean | null> };
  if (!body.name || !analyticsEventNames.includes(body.name)) return Response.json({ error: "Evento inválido." }, { status: 400 });
  const user = await getAuthenticatedUser();
  await addAnalyticsEvent({ id: crypto.randomUUID(), name: body.name, path: typeof body.path === "string" ? body.path.slice(0, 200) : null, agencyId: typeof body.agencyId === "string" ? body.agencyId.slice(0, 80) : null, userEmail: user?.email ?? null, metadata: body.metadata ?? {}, createdAt: new Date().toISOString() });
  return Response.json({ ok: true }, { status: 201 });
}
