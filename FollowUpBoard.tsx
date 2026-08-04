"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Agency, TaskPriority, TaskRecord } from "@/lib/types";

const priorities: TaskPriority[] = ["Baixa", "Média", "Alta", "Urgente"];
const initialForm = { agencyId: "", title: "", dueAt: "", priority: "Média" as TaskPriority, activityType: "Follow-up", notes: "" };

function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }

export default function FollowUpBoard() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const load = () => Promise.all([fetch("/api/tasks").then(async (r) => await r.json() as TaskRecord[]), fetch("/api/agencies").then(async (r) => await r.json() as Agency[])]).then(([nextTasks, nextAgencies]) => { setTasks(nextTasks); setAgencies(nextAgencies); if (!form.agencyId && nextAgencies[0]) setForm((current) => ({ ...current, agencyId: nextAgencies[0].id })); });
  useEffect(() => { load(); }, []);
  const today = dayKey();
  const open = tasks.filter((task) => task.status === "Aberta");
  const overdue = open.filter((task) => task.dueAt.slice(0, 10) < today);
  const todayTasks = open.filter((task) => task.dueAt.slice(0, 10) === today);
  const upcoming = open.filter((task) => task.dueAt.slice(0, 10) > today);
  const completed = useMemo(() => tasks.filter((task) => task.status === "Concluída"), [tasks]);
  async function submit(event: FormEvent) { event.preventDefault(); setMessage("Salvando…"); const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); if (!response.ok) { setMessage("Não foi possível salvar a tarefa."); return; } setMessage("Follow-up criado."); setForm((current) => ({ ...initialForm, agencyId: current.agencyId })); await load(); }
  async function complete(id: string) { await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "Concluída" }) }); await load(); }
  const column = (title: string, items: TaskRecord[], tone: string) => <section className={`follow-column follow-${tone}`}><div className="follow-column-head"><div><span className="eyebrow">{tone === "overdue" ? "Atenção" : tone === "today" ? "Agenda" : "Depois"}</span><h2>{title}</h2></div><b>{items.length}</b></div>{items.map((task) => <article className="follow-card" key={task.id}><div><span className={`priority-dot priority-${task.priority.toLowerCase()}`}>{task.priority}</span><time>{task.dueAt.replace("T", " · ")}</time></div><h3>{task.title}</h3><p>{task.agencyName} · {task.agencyCity}</p>{task.notes && <small>{task.notes}</small>}<button type="button" onClick={() => complete(task.id)}>Marcar concluído ✓</button></article>)}{items.length === 0 && <p className="follow-empty">Nenhuma tarefa nesta lista.</p>}</section>;
  return <div className="crm-layout"><aside className="crm-sidebar"><div className="crm-sidebar-brand"><span className="brand-mark">RS</span><div><strong>Mapa de Agências</strong><small>Operação comercial</small></div></div><nav aria-label="Menu comercial"><span className="crm-nav-label">Workspace</span><Link href="/dashboard">Dashboard</Link><Link href="/mapa">Mapa regional</Link><Link href="/agencias">Agências</Link><Link className="crm-nav-active" href="/follow-ups">Follow-ups</Link><span className="crm-nav-label">Gestão</span><Link href="/admin">Painel administrativo</Link></nav></aside><section className="crm-content"><header className="crm-heading"><div><span className="eyebrow">Atividades comerciais</span><h1>Follow-ups</h1><p>Organize a próxima ação e não deixe uma oportunidade esfriar.</p></div></header><section className="follow-create"><div><span className="eyebrow">Nova tarefa</span><h2>Agendar uma próxima ação</h2><p>{message || "Ao concluir, a interação entra automaticamente no histórico da agência."}</p></div><form onSubmit={submit}><select required value={form.agencyId} onChange={(e) => setForm({ ...form, agencyId: e.target.value })}><option value="">Selecione a agência</option>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.tradeName} · {agency.city}</option>)}</select><input required placeholder="Título da tarefa" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input required type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select><select value={form.activityType} onChange={(e) => setForm({ ...form, activityType: e.target.value })}><option>Follow-up</option><option>Ligação</option><option>WhatsApp</option><option>E-mail</option><option>Reunião</option><option>Visita</option></select><input placeholder="Observação opcional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><button className="button primary">Criar tarefa</button></form></section><div className="follow-columns">{column("Atrasados", overdue, "overdue")}{column("Hoje", todayTasks, "today")}{column("Próximos", upcoming, "upcoming")}</div><section className="completed-tasks"><span className="eyebrow">Histórico</span><h2>Tarefas concluídas · {completed.length}</h2></section></section></div>;
}
