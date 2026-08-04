import AdminPanel from "@/app/components/AdminPanel";
import { requireRole } from "@/app/auth";

export default async function AdminPage() {
  await requireRole(["admin", "gestor"], "/admin");
  return <main className="admin-page"><AdminPanel /></main>;
}
