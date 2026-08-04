import LeadsWorkspace from "@/app/components/LeadsWorkspace";
import { requireAuthenticatedUser } from "@/app/auth";

export default async function LeadsPage() {
  await requireAuthenticatedUser("/leads");
  return <main className="workspace-page"><LeadsWorkspace /></main>;
}
