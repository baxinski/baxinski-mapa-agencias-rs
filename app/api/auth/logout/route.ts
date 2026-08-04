import { deleteGithubSession } from "@/db";
import { GITHUB_SESSION_COOKIE, readCookie, serializeCookie } from "@/app/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = readCookie(request, GITHUB_SESSION_COOKIE);
  if (sessionId) await deleteGithubSession(sessionId);
  const secure = new URL(request.url).protocol === "https:";
  const headers = new Headers({ Location: new URL("/", request.url).toString() });
  headers.append("Set-Cookie", serializeCookie(GITHUB_SESSION_COOKIE, "", { maxAge: 0, secure }));
  return new Response("Redirecting", { status: 302, headers });
}

export async function POST(request: Request) {
  const sessionId = readCookie(request, GITHUB_SESSION_COOKIE);
  if (sessionId) await deleteGithubSession(sessionId);
  const secure = new URL(request.url).protocol === "https:";
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", serializeCookie(GITHUB_SESSION_COOKIE, "", { maxAge: 0, secure }));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
