import { redirect } from "next/navigation";

export default async function FollowUpsPage() {
  // FollowUpBoard was consolidated into AccompanimentWorkspace; this legacy route keeps the old bookmark working.
  redirect("/acompanhamento");
}

