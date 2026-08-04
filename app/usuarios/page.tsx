import UsersWorkspace from "@/app/components/UsersWorkspace";
import { requireRole } from "@/app/auth";

export default async function UsersPage() {
  await requireRole(["admin"], "/usuarios");
  return <main className="workspace-page"><UsersWorkspace /></main>;
}
