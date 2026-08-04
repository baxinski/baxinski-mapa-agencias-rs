import { getAuthenticatedUser } from "@/app/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  return Response.json({ user });
}
