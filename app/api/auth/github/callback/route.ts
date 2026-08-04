import { env } from "cloudflare:workers";
import { saveGithubSession } from "@/db";
import {
  GITHUB_RETURN_COOKIE,
  GITHUB_SESSION_COOKIE,
  GITHUB_SESSION_MAX_AGE,
  GITHUB_STATE_COOKIE,
  randomToken,
  readCookie,
  safeReturnTo,
  serializeCookie,
} from "@/app/github-auth";

export const dynamic = "force-dynamic";

type GithubProfile = { id: number; login: string; name: string | null; email: string | null; avatar_url: string | null };
type GithubEmail = { email: string; primary: boolean; verified: boolean };

function fail(request: Request, code: string) {
  return Response.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, request.url), 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const savedState = readCookie(request, GITHUB_STATE_COOKIE);
  const returnTo = safeReturnTo(readCookie(request, GITHUB_RETURN_COOKIE), "/");
  if (!code || !returnedState || !savedState || returnedState !== savedState) return fail(request, "github_state_invalid");

  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const clientId = runtimeEnv.GITHUB_CLIENT_ID;
  const clientSecret = runtimeEnv.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(request, "github_not_configured");

  const callback = new URL("/api/auth/github/callback", request.url).toString();
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mapa-de-Agencias-RS" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callback }),
  });
  if (!tokenResponse.ok) return fail(request, "github_token_failed");
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) return fail(request, "github_token_missing");

  const apiHeaders = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token.access_token}`, "User-Agent": "Mapa-de-Agencias-RS" };
  const profileResponse = await fetch("https://api.github.com/user", { headers: apiHeaders });
  if (!profileResponse.ok) return fail(request, "github_profile_failed");
  const profile = await profileResponse.json() as GithubProfile;

  let email = profile.email;
  const emailResponse = await fetch("https://api.github.com/user/emails", { headers: apiHeaders });
  if (emailResponse.ok) {
    const emails = await emailResponse.json() as GithubEmail[];
    email = emails.find((item) => item.primary && item.verified)?.email ?? emails.find((item) => item.verified)?.email ?? email;
  }

  const now = new Date();
  const sessionId = randomToken();
  await saveGithubSession({
    sessionId,
    githubId: String(profile.id),
    login: profile.login,
    displayName: profile.name?.trim() || profile.login,
    email,
    avatarUrl: profile.avatar_url,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + GITHUB_SESSION_MAX_AGE * 1000).toISOString(),
  });

  const secure = url.protocol === "https:";
  const headers = new Headers({ Location: new URL(returnTo, request.url).toString() });
  headers.append("Set-Cookie", serializeCookie(GITHUB_SESSION_COOKIE, sessionId, { maxAge: GITHUB_SESSION_MAX_AGE, secure }));
  headers.append("Set-Cookie", serializeCookie(GITHUB_STATE_COOKIE, "", { maxAge: 0, secure }));
  headers.append("Set-Cookie", serializeCookie(GITHUB_RETURN_COOKIE, "", { maxAge: 0, secure }));
  return new Response("Redirecting", { status: 302, headers });
}
