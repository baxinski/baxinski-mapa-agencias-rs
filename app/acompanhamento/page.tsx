import { requireAuthenticatedUser } from "@/app/auth";
import AccompanimentWorkspace from "@/app/components/AccompanimentWorkspace";

export default async function AccompanimentPage() {
  await requireAuthenticatedUser("/acompanhamento");
  return <main className="workspace-page"><AccompanimentWorkspace /></main>;
}

