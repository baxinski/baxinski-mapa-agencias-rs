import { listStatusHistory } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const agencyId = new URL(request.url).searchParams.get("agencyId");
  if (!agencyId) return Response.json({ error: "agencyId obrigatório." }, { status: 400 });
  return Response.json(await listStatusHistory(agencyId));
}
