import { env } from "cloudflare:workers";
import { GITHUB_RETURN_COOKIE, GITHUB_STATE_COOKIE, randomToken, safeReturnTo, serializeCookie } from "@/app/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const clientId = runtimeEnv.GITHUB_CLIENT_ID;
  if (!clientId) {
    return Response.redirect(new URL("/login?error=github_not_configured", request.url), 302);
  }

  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("return_to"), "/");
  const state = randomToken();
  const callback = new URL("/api/auth/github/callback", request.url).toString();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("scope", "read:user user:email");
  authorize.searchParams.set("state", state);

  const secure = url.protocol === "https:";
  const response = Response.redirect(authorize, 302);
  response.headers.append("Set-Cookie", serializeCookie(GITHUB_STATE_COOKIE, state, { maxAge: 600, secure }));
  response.headers.append("Set-Cookie", serializeCookie(GITHUB_RETURN_COOKIE, returnTo, { maxAge: 600, secure }));
  return response;
}
