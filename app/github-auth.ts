import { getGithubSession } from "@/db";

export const GITHUB_SESSION_COOKIE = "mapa_agencias_github_session";
export const GITHUB_STATE_COOKIE = "mapa_agencias_github_state";
export const GITHUB_RETURN_COOKIE = "mapa_agencias_github_return";
export const GITHUB_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type GithubUser = {
  displayName: string;
  email: string;
  fullName: string | null;
  provider: "github";
  login: string;
  avatarUrl: string | null;
};

export function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function safeReturnTo(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://mapa-agencias-rs.local");
    if (url.origin !== "https://mapa-agencias-rs.local") return fallback;
    if (["/login", "/api/auth/github", "/api/auth/github/callback"].includes(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export function serializeCookie(name: string, value: string, options: { maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "Lax" | "Strict" | "None"; path?: string } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);
  if (options.secure !== false) parts.push("Secure");
  return parts.join("; ");
}

export async function getGithubUserFromRequest(request: Request): Promise<GithubUser | null> {
  const sessionId = readCookie(request, GITHUB_SESSION_COOKIE);
  if (!sessionId) return null;
  const session = await getGithubSession(sessionId);
  if (!session) return null;
  return {
    displayName: session.displayName,
    email: session.email ?? `${session.login}@users.noreply.github.com`,
    fullName: session.displayName,
    provider: "github",
    login: session.login,
    avatarUrl: session.avatarUrl,
  };
}
