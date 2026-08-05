"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BrandLogo from "./BrandLogo";
import type { TaskPriority, TaskRecord } from "@/lib/types";

const priorities: TaskPriority[] = ["Baixa", "Média", "Alta", "Urgente"];
const initialForm = { agencyId: "", title: "", dueAt: "", priority: "Média" as TaskPriority, activityType: "Follow-up", notes: "" };

type FollowUpAgency = {
  id: string;
  tradeName: string;
  city: string;
  region: string;
  kind: "exchange" | "tourism";
};

type FollowUpAgencyPayload = {
  agencies: FollowUpAgency[];
};

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export default function FollowUpBoard() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [agencies, setAgencies] = useState<FollowUpAgency[]>([]);
  const [agencyQuery, setAgencyQuery] = useState("");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [tasksResponse, agenciesResponse] = await Promise.all([fetch("/api/tasks"), fetch("/api/follow-up-agencies")]);
    if (!tasksResponse.ok || !agenciesResponse.ok) throw new Error("Não foi possível carregar as agências e tarefas.");
    const [nextTasks, nextAgencyPayload] = await Promise.all([
      tasksResponse.json() as Promise<TaskRecord[]>,
      agenciesResponse.json() as Promise<FollowUpAgencyPayload>,
    ]);
    const nextAgencies = nextAgencyPayload.agencies ?? [];
    setTasks(nextTasks);
    setAgencies(nextAgencies);
    setForm((current) => current.agencyId || !nextAgencies[0] ? current : { ...current, agencyId: nextAgencies[0].id });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch(() => setMessage("Não foi possível carregar a base de agências."));
  }, []);

  const filteredAgencies = useMemo(() => {
    const query = agencyQuery.trim().toLocaleLowerCase("pt-BR");
    const matching = !query ? agencies : agencies.filter((agency) => `${agency.tradeName} ${agency.city} ${agency.region}`.toLocaleLowerCase("pt-BR").includes(query));
    const selected = agencies.find((agency) => agency.id === form.agencyId);
    if (selected && !matching.some((agency) => agency.id === selected.id)) return [selected, ...matching];
    return matching;
  }, [agencies, agencyQuery, form.agencyId]);
  const exchangeAgencies = filteredAgencies.filter((agency) => agency.kind === "exchange");
  const tourismAgencies = filteredAgencies.filter((agency) => agency.kind === "tourism");

  const today = dayKey();
  const open = tasks.filter((task) => task.status === "Aberta");
  const overdue = open.filter((task) => task.dueAt.slice(0, 10) < today);
  const todayTasks = open.filter((task) => task.dueAt.slice(0, 10) === today);
  const upcoming = open.filter((task) => task.dueAt.slice(0, 10) > today);
  const completed = useMemo(() => tasks.filter((task) => task.status === "Concluída"), [tasks]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("Salvando…");
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(result?.error ?? "Não foi possível salvar a tarefa.");
      return;
    }
    setMessage("Follow-up criado.");
    setForm((current) => ({ ...initialForm, agencyId: current.agencyId }));
    await load();
  }

  async function complete(id: string) {
    await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "Concluída" }) });
    await load();
  }

  const column = (title: string, items: TaskRecord[], tone: string) => (
    <section className={`follow-column follow-${tone}`}>
      <div className="follow-column-head"><div><span className="eyebrow">{tone === "overdue" ? "Atenção" : tone === "today" ? "Agenda" : "Depois"}</span><h2>{title}</h2></div><b>{items.length}</b></div>
      {items.map((task) => <article className="follow-card" key={task.id}><div><span className={`priority-dot priority-${task.priority.toLowerCase()}`}>{task.priority}</span><time>{task.dueAt.replace("T", " · ")}</time></div><h3>{task.title}</h3><p>{task.agencyName} · {task.agencyCity}</p>{task.notes && <small>{task.notes}</small>}<button type="button" onClick={() => complete(task.id)}>Marcar concluído ✓</button></article>)}
      {items.length === 0 && <p className="follow-empty">Nenhuma tarefa nesta lista.</p>}
    </section>
  );

  return <div className="crm-layout">
    <aside className="crm-sidebar"><div className="crm-sidebar-brand"><BrandLogo framed /></div><nav aria-label="Menu de consulta"><span className="crm-nav-label">Workspace</span><Link href="/dashboard">Dashboard</Link><Link href="/mapa">Mapa regional</Link><Link href="/agencias">Agências</Link><Link className="crm-nav-active" href="/follow-ups">Follow-ups</Link><span className="crm-nav-label">Gestão</span><Link href="/admin">Painel administrativo</Link></nav></aside>
    <section className="crm-content"><header className="crm-heading"><div><span className="eyebrow">Atividades de consulta</span><h1>Follow-ups</h1><p>Registre uma próxima ação para qualquer agência do diretório do Rio Grande do Sul.</p></div></header>
      <section className="follow-create"><div><span className="eyebrow">Nova tarefa</span><h2>Agendar uma próxima ação</h2><p>{message || "A interação entra automaticamente no histórico da agência."}</p></div>
        <form onSubmit={submit}>
          <input value={agencyQuery} onChange={(event) => setAgencyQuery(event.target.value)} placeholder="Filtrar agência por nome ou cidade" aria-label="Filtrar agências por nome ou cidade" />
          <select required value={form.agencyId} onChange={(event) => setForm({ ...form, agencyId: event.target.value })} aria-label="Selecionar agência"><option value="">Selecione a agência</option>{exchangeAgencies.length > 0 && <optgroup label={`Intercâmbio (${exchangeAgencies.length})`}>{exchangeAgencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.tradeName} · {agency.city}</option>)}</optgroup>}{tourismAgencies.length > 0 && <optgroup label={`Agências de turismo (${tourismAgencies.length})`}>{tourismAgencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.tradeName} · {agency.city}</option>)}</optgroup>}</select>
          <input required placeholder="Título da tarefa" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <input required type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} />
          <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select>
          <select value={form.activityType} onChange={(event) => setForm({ ...form, activityType: event.target.value })}><option>Follow-up</option><option>Ligação</option><option>WhatsApp</option><option>E-mail</option><option>Reunião</option><option>Visita</option></select>
          <input placeholder="Observação opcional" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /><button className="button primary">Criar tarefa</button>
        </form>
      </section>
      <div className="follow-columns">{column("Atrasados", overdue, "overdue")}{column("Hoje", todayTasks, "today")}{column("Próximos", upcoming, "upcoming")}</div>
      <section className="completed-tasks"><span className="eyebrow">Histórico</span><h2>Tarefas concluídas · {completed.length}</h2></section>
    </section>
  </div>;
}
