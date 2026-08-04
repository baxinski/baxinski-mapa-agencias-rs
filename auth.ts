import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getGithubSession, type GithubSessionRecord } from "@/db";
import { GITHUB_SESSION_COOKIE } from "@/app/github-auth";

export type AuthenticatedUser = (ChatGPTUser & { provider: "chatgpt" }) | {
  displayName: string;
  email: string;
  fullName: string | null;
  provider: "github";
  login: string;
  avatarUrl: string | null;
};

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
