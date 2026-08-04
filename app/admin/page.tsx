import AdminPanel from "@/app/components/AdminPanel";
import { requireAuthenticatedUser } from "@/app/auth";

export default async function AdminPage() {
  await requireAuthenticatedUser("/admin");
  return <main className="admin-page"><AdminPanel /></main>;
}
