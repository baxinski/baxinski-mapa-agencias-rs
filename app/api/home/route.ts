import { listAgencies } from "@/db";
import { buildHomeSnapshot } from "@/lib/home";
import { seedAgencies } from "@/lib/seed";
import { activeTourismAgencies } from "@/lib/tourism";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agencies = await listAgencies();
    const snapshot = buildHomeSnapshot(agencies, activeTourismAgencies);
    return Response.json(snapshot, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    const snapshot = buildHomeSnapshot(seedAgencies, activeTourismAgencies);
    return Response.json(snapshot, { headers: { "Cache-Control": "public, max-age=60" } });
  }
}

