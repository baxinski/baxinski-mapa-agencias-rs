import GitHubLogin from "@/app/components/GitHubLogin";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = typeof params?.return_to === "string" && params.return_to.startsWith("/") && !params.return_to.startsWith("//") ? params.return_to : "/dashboard";
  const error = typeof params?.error === "string" ? params.error : undefined;
  const current = await getAuthenticatedUserWithRole();
  const restrictedPath = ["/admin", "/importar", "/usuarios"].some((path) => returnTo === path || returnTo.startsWith(`${path}/`));
  const canOpenReturnTo = !restrictedPath || Boolean(current && ["admin", "gestor"].includes(current.role));
  if (current && canOpenReturnTo && (!error || error === "sem_permissao")) redirect(returnTo);
  return <main className="login-page"><div className="login-shell"><GitHubLogin returnTo={returnTo} error={error} /></div></main>;
}
