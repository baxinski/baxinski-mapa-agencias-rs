import { deleteGithubSession } from "@/db";
import { chatGPTSignOutPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { GITHUB_SESSION_COOKIE, readCookie, serializeCookie } from "@/app/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = readCookie(request, GITHUB_SESSION_COOKIE);
  if (sessionId) await deleteGithubSession(sessionId);
  const chatgpt = await getChatGPTUser();
  const secure = new URL(request.url).protocol === "https:";
  const destination = chatgpt ? chatGPTSignOutPath("/") : "/";
  const headers = new Headers({ Location: new URL(destination, request.url).toString(), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", serializeCookie(GITHUB_SESSION_COOKIE, "", { maxAge: 0, secure }));
  return new Response("Redirecting", { status: 302, headers });
}

export async function POST(request: Request) {
  const sessionId = readCookie(request, GITHUB_SESSION_COOKIE);
  if (sessionId) await deleteGithubSession(sessionId);
  const chatgpt = await getChatGPTUser();
  const secure = new URL(request.url).protocol === "https:";
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", serializeCookie(GITHUB_SESSION_COOKIE, "", { maxAge: 0, secure }));
  return new Response(JSON.stringify({ ok: true, signOutUrl: chatgpt ? chatGPTSignOutPath("/") : "/" }), { status: 200, headers });
}
