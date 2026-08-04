"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardResponse } from "@/lib/types";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function BarChart({ title, items, tone = "blue" }: { title: string; items: Array<{ label: string; value: number }>; tone?: "blue" | "red" | "green" }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return <section className="dashboard-chart"><div className="dashboard-chart-head"><h2>{title}</h2><span>{items.length} itens</span></div><div className="bar-chart">{items.map((item) => <div className="bar-row" key={item.label}><span title={item.label}>{item.label}</span><div><i className={`bar-fill bar-${tone}`} style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} /></div><b>{item.value.toLocaleString("pt-BR")}</b></div>)}</div></section>;
}

function Metric({ label, value, hint, tone = "normal" }: { label: string; value: string | number; hint?: string; tone?: "normal" | "alert" | "good" }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</article>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/dashboard").then(async (response) => { if (!response.ok) throw new Error(); return await response.json() as DashboardResponse; }).then(setData).catch(() => setError("Não foi possível carregar os indicadores agora.")); }, []);
  if (error) return <div className="empty-state"><strong>{error}</strong><p>Atualize a página para tentar novamente.</p></div>;
  if (!data) return <div className="loading-panel"><strong>Preparando o painel comercial…</strong><p>Consolidando agências, contatos e follow-ups.</p></div>;
  const { metrics, charts } = data;
  return <div className="crm-layout">
    <aside className="crm-sidebar"><div className="crm-sidebar-brand"><span className="brand-mark">RS</span><div><strong>Mapa de Agências</strong><small>Operação comercial</small></div></div><nav aria-label="Menu comercial"><span className="crm-nav-label">Workspace</span><Link className="crm-nav-active" href="/dashboard">Dashboard</Link><Link href="/mapa">Mapa regional</Link><Link href="/agencias">Agências</Link><Link href="/follow-ups">Follow-ups</Link><span className="crm-nav-label">Gestão</span><Link href="/agencias?status=Oportunidade%20qualificada">Oportunidades</Link><Link href="/admin">Painel administrativo</Link></nav><div className="crm-sidebar-note"><span>Base atual</span><strong>{metrics.totalAgencies}</strong><small>agências de intercâmbio</small></div></aside>
    <section className="crm-content"><header className="crm-heading"><div><span className="eyebrow">Inteligência comercial · RS</span><h1>Bom dia, equipe.</h1><p>Priorize contatos, acompanhe o funil e transforme cobertura em próximas conversas.</p></div><Link className="button primary" href="/mapa">Explorar mapa <span>↗</span></Link></header>
      <div className="dashboard-actions"><Link href="/agencias?status=Oportunidade%20qualificada">Ver oportunidades prioritárias <span>→</span></Link><Link href="/follow-ups">Follow-ups de hoje <b>{metrics.todayFollowUps}</b></Link><Link href="/admin">Cadastrar agência <span>＋</span></Link><Link href="/admin">Registrar contato <span>＋</span></Link></div>
      <div className="metric-grid"><Metric label="Agências cadastradas" value={metrics.totalAgencies} hint={`${metrics.notContacted} ainda não contatadas`} /><Metric label="Oportunidades em andamento" value={metrics.opportunities} hint={`${metrics.proposals} propostas · ${metrics.negotiations} negociações`} tone="good" /><Metric label="Follow-ups atrasados" value={metrics.overdueFollowUps} hint={`${metrics.todayFollowUps} previstos para hoje`} tone={metrics.overdueFollowUps ? "alert" : "normal"} /><Metric label="Taxa de conversão" value={`${metrics.conversionRate}%`} hint={`${metrics.clients} clientes conquistados`} tone="good" /><Metric label="Contatos · últimos 7 dias" value={metrics.contactsLast7Days} hint={`${metrics.contacted} agências já contatadas`} /><Metric label="Valor potencial do funil" value={money(metrics.pipelineValue)} hint="Soma das oportunidades com valor informado" /></div>
      <div className="dashboard-grid"><BarChart title="Agências por cidade" items={charts.byCity} /><BarChart title="Potencial por região" items={charts.byRegion} tone="red" /><BarChart title="Agências por status comercial" items={charts.byStatus} tone="green" /><BarChart title="Contatos por período" items={charts.contactsByDay} /></div>
      <div className="dashboard-lower"><section className="dashboard-list"><div className="dashboard-list-head"><div><span className="eyebrow">Prioridade</span><h2>Melhores oportunidades</h2></div><Link href="/agencias">Ver todas →</Link></div>{data.priorityAgencies.map((agency) => <Link className="priority-row" href={`/agencias/${agency.slug}`} key={agency.id}><span className="score-badge">{agency.opportunityScore ?? 0}</span><span><strong>{agency.tradeName}</strong><small>{agency.city} · {agency.commercialStatus ?? "Não contatada"}</small></span><b>Potencial {agency.commercialPotential}</b></Link>)}</section><section className="dashboard-list"><div className="dashboard-list-head"><div><span className="eyebrow">Atenção</span><h2>Follow-ups atrasados</h2></div><Link href="/follow-ups">Abrir lista →</Link></div>{data.overdueTasks.length ? data.overdueTasks.map((task) => <Link className="task-row" href="/follow-ups" key={task.id}><span className="task-date">{task.dueAt.slice(0, 10)}</span><span><strong>{task.title}</strong><small>{task.agencyName} · {task.priority}</small></span><b>Resolver →</b></Link>) : <p className="dashboard-empty">Nenhum follow-up atrasado.</p>}</section></div>
    </section>
  </div>;
}
