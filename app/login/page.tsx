import GitHubLogin from "@/app/components/GitHubLogin";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = typeof params?.return_to === "string" && params.return_to.startsWith("/") && !params.return_to.startsWith("//") ? params.return_to : "/dashboard";
  const error = typeof params?.error === "string" ? params.error : undefined;
  return <main className="login-page"><div className="login-shell"><GitHubLogin returnTo={returnTo} error={error} /></div></main>;
}
