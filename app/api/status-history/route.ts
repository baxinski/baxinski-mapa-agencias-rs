import { listStatusHistory } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthenticatedUserWithRole())) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  const agencyId = new URL(request.url).searchParams.get("agencyId");
  if (!agencyId) return Response.json({ error: "agencyId obrigatório." }, { status: 400 });
  return Response.json(await listStatusHistory(agencyId));
}
