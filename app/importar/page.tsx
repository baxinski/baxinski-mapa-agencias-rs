import ImportWorkspace from "@/app/components/ImportWorkspace";
import { requireRole } from "@/app/auth";

export default async function ImportPage() {
  await requireRole(["admin", "gestor"], "/importar");
  return <main className="page-shell"><ImportWorkspace /></main>;
}
