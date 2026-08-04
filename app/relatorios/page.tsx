import ReportsWorkspace from "@/app/components/ReportsWorkspace";
import { requireAuthenticatedUser } from "@/app/auth";

export default async function ReportsPage() {
  await requireAuthenticatedUser("/relatorios");
  return <main className="workspace-page"><ReportsWorkspace /></main>;
}
