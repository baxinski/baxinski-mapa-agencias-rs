import FollowUpBoard from "@/app/components/FollowUpBoard";
import { requireAuthenticatedUser } from "@/app/auth";

export default async function FollowUpsPage() {
  await requireAuthenticatedUser("/follow-ups");
  return <main className="crm-page"><FollowUpBoard /></main>;
}
