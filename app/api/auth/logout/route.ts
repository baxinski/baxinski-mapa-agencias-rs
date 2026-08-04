import { deleteGithubSession } from "@/db";
import { GITHUB_SESSION_COOKIE, readCookie, serializeCookie } from "@/app/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = readCookie(request, GITHUB_SESSION_COOKIE);
  if (sessionId) await deleteGithubSession(sessionId);
  const secure = new URL(request.url).protocol === "https:";
  const response = Response.redirect(new URL("/", request.url), 302);
  response.headers.append("Set-Cookie", serializeCookie(GITHUB_SESSION_COOKIE, "", { maxAge: 0, secure }));
  return response;
}

export async function POST(request: Request) {
  const sessionId = readCookie(request, GITHUB_SESSION_COOKIE);
  if (sessionId) await deleteGithubSession(sessionId);
  const secure = new URL(request.url).protocol === "https:";
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", serializeCookie(GITHUB_SESSION_COOKIE, "", { maxAge: 0, secure }));
  return response;
}
