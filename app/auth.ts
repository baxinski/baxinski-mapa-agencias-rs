import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getGithubSession, getUserRole, type GithubSessionRecord } from "@/db";
import { GITHUB_SESSION_COOKIE } from "@/app/github-auth";
import type { UserRole } from "@/lib/types";

export type AuthenticatedUser = (ChatGPTUser & { provider: "chatgpt" }) | {
  displayName: string;
  email: string;
  fullName: string | null;
  provider: "github";
  login: string;
  avatarUrl: string | null;
};

export type AuthenticatedUserWithRole = AuthenticatedUser & { role: UserRole; userKey: string };

function githubUser(session: GithubSessionRecord) {
  return {
    displayName: session.displayName,
    email: session.email ?? `${session.login}@users.noreply.github.com`,
    fullName: session.displayName,
    provider: "github" as const,
    login: session.login,
    avatarUrl: session.avatarUrl,
  };
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const chatgpt = await getChatGPTUser();
  if (chatgpt) return { ...chatgpt, provider: "chatgpt" };

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(GITHUB_SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const session = await getGithubSession(sessionId);
  return session ? githubUser(session) : null;
}

export async function requireAuthenticatedUser(returnTo: string): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  redirect(`/login?return_to=${encodeURIComponent(safeReturnTo)}`);
}

function userKey(user: AuthenticatedUser) {
  return user.provider === "github" ? `github:${user.login}` : `email:${user.email.toLowerCase()}`;
}

export async function getAuthenticatedUserWithRole(): Promise<AuthenticatedUserWithRole | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const key = userKey(user);
  const stored = await getUserRole(key);
  const configuredAdmins = String((env as unknown as Record<string, string | undefined>).ADMIN_GITHUB_LOGINS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const isConfiguredAdmin = user.provider === "github" && configuredAdmins.includes(user.login.toLowerCase());
  const role = isConfiguredAdmin ? "admin" : (stored?.active ? stored.role : "consulta") as UserRole;
  return { ...user, role, userKey: key };
}

export async function requireRole(roles: UserRole[], returnTo: string): Promise<AuthenticatedUserWithRole> {
  const user = await getAuthenticatedUserWithRole();
  if (!user) {
    const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
    redirect(`/login?return_to=${encodeURIComponent(safeReturnTo)}`);
  }
  if (!roles.includes(user.role)) redirect(`/login?error=sem_permissao&return_to=${encodeURIComponent(returnTo)}`);
  return user;
}
