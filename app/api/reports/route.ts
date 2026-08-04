import { getCommercialSummary, listAgencies, listLeads, summarizeAnalytics } from "@/db";
import { getAuthenticatedUserWithRole } from "@/app/auth";
import { commercialStatuses } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  const [agencies, activity, leads, events] = await Promise.all([listAgencies(), getCommercialSummary(), listLeads(), summarizeAnalytics(30)]);
  const status = commercialStatuses.map((label) => ({ label, value: agencies.filter((agency) => (agency.commercialStatus ?? "Não contatada") === label).length }));
  const cities = [...new Map(agencies.map((agency) => [agency.city, agencies.filter((item) => item.city === agency.city).length])).entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  const region = [...new Map(agencies.map((agency) => [agency.region, agencies.filter((item) => item.region === agency.region).reduce((sum, item) => sum + (item.opportunityScore ?? 0), 0)])).entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const pipeline = agencies.filter((agency) => ["Oportunidade qualificada", "Proposta enviada", "Em negociação"].includes(agency.commercialStatus ?? "")).reduce((sum, agency) => sum + (agency.estimatedValue ?? 0), 0);
  return Response.json({ generatedAt: new Date().toISOString(), role: user.role, totals: { agencies: agencies.length, contacts: activity.contacts.length, tasks: activity.tasks.length, openTasks: activity.tasks.filter((task) => task.status === "Aberta").length, leads: leads.length, pipeline }, status, cities, region, events });
}
