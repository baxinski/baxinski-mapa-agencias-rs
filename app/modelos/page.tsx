import TemplatesWorkspace from "@/app/components/TemplatesWorkspace";
import { requireAuthenticatedUser } from "@/app/auth";

export default async function TemplatesPage() {
  await requireAuthenticatedUser("/modelos");
  return <main className="workspace-page"><TemplatesWorkspace /></main>;
}
