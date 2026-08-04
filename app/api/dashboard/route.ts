import { getCommercialSummary, listAgencies } from "@/db";
import { regionForCity } from "@/lib/regional";
import { activeTourismAgencies } from "@/lib/tourism";
import { commercialStatuses, type DashboardResponse } from "@/lib/types";
import { getAuthenticatedUserWithRole } from "@/app/auth";

export const dynamic = "force-dynamic";

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

type DirectoryRecord = { city: string; region: string };

const tourismDirectoryRecords: DirectoryRecord[] = activeTourismAgencies.map((agency) => ({ city: agency.city, region: regionForCity(agency.city) }));

function countsBy(items: DirectoryRecord[], getKey: (item: DirectoryRecord) => string) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(getKey(item), (counts.get(getKey(item)) ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export async function GET() {
  const user = await getAuthenticatedUserWithRole();
  if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
  const [agencies, activity] = await Promise.all([listAgencies(), getCommercialSummary()]);
  const today = new Date();
  const todayKey = dateKey(today);
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 6);
  const statuses = agencies.map((agency) => agency.commercialStatus ?? "Não contatada");
  const opportunityStatuses = new Set(["Oportunidade qualificada", "Proposta enviada", "Em negociação"]);
  const discardedStatuses = new Set(["Sem interesse", "Inativa"]);
  const openTasks = activity.tasks.filter((task) => task.status === "Aberta");
  const overdueTasks = openTasks.filter((task) => task.dueAt.slice(0, 10) < todayKey).slice(0, 8);
  const todayTasks = openTasks.filter((task) => task.dueAt.slice(0, 10) === todayKey).slice(0, 8);
  const contactsLast7Days = activity.contacts.filter((contact) => contact.contactDate >= dateKey(lastWeek)).length;
  const directoryRecords: DirectoryRecord[] = [
    ...agencies.map((agency) => ({ city: agency.city, region: agency.region })),
    ...tourismDirectoryRecords,
  ];
  const byCity = countsBy(directoryRecords, (item) => item.city).slice(0, 8);
  const byRegion = countsBy(directoryRecords, (item) => item.region).slice(0, 8);
  const contactsByDay: Array<{ label: string; value: number }> = [];
  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - index);
    const key = dateKey(day);
    contactsByDay.push({ label: key.slice(5).replace("-", "/"), value: activity.contacts.filter((contact) => contact.contactDate === key).length });
  }
  const pipelineByStatus = [...opportunityStatuses].map((label) => ({ label, value: agencies.filter((agency) => (agency.commercialStatus ?? "Não contatada") === label).reduce((total, agency) => total + (agency.estimatedValue ?? 0), 0) }));
  const exchangeTotal = agencies.length;
  const total = directoryRecords.length;
  const clients = statuses.filter((status) => status === "Cliente").length;
  const response: DashboardResponse = {
    metrics: {
      totalAgencies: total,
      exchangeAgencies: exchangeTotal,
      tourismAgencies: activeTourismAgencies.length,
      notContacted: statuses.filter((status) => status === "Não contatada").length,
      contacted: statuses.filter((status) => status !== "Não contatada").length,
      opportunities: statuses.filter((status) => opportunityStatuses.has(status)).length,
      meetings: statuses.filter((status) => status === "Reunião agendada").length,
      proposals: statuses.filter((status) => status === "Proposta enviada").length,
      negotiations: statuses.filter((status) => status === "Em negociação").length,
      clients,
      discarded: statuses.filter((status) => discardedStatuses.has(status)).length,
      contactsLast7Days,
      overdueFollowUps: overdueTasks.length,
      todayFollowUps: todayTasks.length,
      conversionRate: exchangeTotal ? Number(((clients / exchangeTotal) * 100).toFixed(1)) : 0,
      pipelineValue: agencies.filter((agency) => opportunityStatuses.has(agency.commercialStatus ?? "Não contatada")).reduce((totalValue, agency) => totalValue + (agency.estimatedValue ?? 0), 0),
    },
    charts: {
      byCity,
      byRegion,
      byStatus: commercialStatuses.map((label) => ({ label, value: statuses.filter((status) => status === label).length })),
      contactsByDay,
      pipelineByStatus,
    },
    priorityAgencies: [...agencies].sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0)).slice(0, 6),
    overdueTasks,
    todayTasks,
  };
  return Response.json(response, { headers: { "Cache-Control": "private, max-age=30" } });
}
