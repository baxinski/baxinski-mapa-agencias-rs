import Dashboard from "@/app/components/Dashboard";
import { requireAuthenticatedUser } from "@/app/auth";

export default async function DashboardPage() {
  await requireAuthenticatedUser("/dashboard");
  return <main className="crm-page"><Dashboard /></main>;
}
