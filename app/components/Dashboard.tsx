"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccompanimentResponse } from "@/lib/types";

function BarChart({ title, items, tone = "blue" }: { title: string; items: Array<{ label: string; value: number }>; tone?: "blue" | "red" | "green" }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return <section className="dashboard-chart"><div className="dashboard-chart-head"><h2>{title}</h2><span>{items.length} itens</span></div><div className="bar-chart">{items.map((item) => <div className="bar-row" key={item.label}><span title={item.label}>{item.label}</span><div><i className={`bar-fill bar-${tone}`} style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} /></div><b>{item.value.toLocaleString("pt-BR")}</b></div>)}</div></section>;
}

function Metric({ label, value, hint, tone = "normal" }: { label: string; value: string | number; hint?: string; tone?: "normal" | "alert" | "good" }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</article>;
}

export default function Dashboard() {
  const [data, setData] = useState<AccompanimentResponse | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    fetch("/api/acompanhamento", { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return await response.json() as AccompanimentResponse; })
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof DOMException && reason.name === "AbortError" ? "O painel demorou mais que o esperado para responder." : "Não foi possível carregar os indicadores agora."))
      .finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  if (error) return <div className="empty-state"><strong>{error}</strong><p>Verifique a conexão e tente carregar o painel novamente.</p><button className="button primary" type="button" onClick={() => { setError(""); setData(null); setAttempt((value) => value + 1); }}>Tentar novamente</button></div>;
  if (!data) return <div className="loading-panel"><strong>Preparando o painel de consulta…</strong><p>Consolidando agências, contatos e follow-ups.</p></div>;
  const { metrics, agencies, tasks } = data;
  const by = (key: "city" | "region") => [...agencies.reduce((map, agency) => map.set(agency[key], (map.get(agency[key]) ?? 0) + 1), new Map<string, number>()).entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const byStatus = [...new Set(agencies.map((agency) => agency.accompanimentStatus ?? "Não analisada"))].map((label) => ({ label, value: agencies.filter((agency) => agency.accompanimentStatus === label).length })).sort((a, b) => b.value - a.value);
  const openTasks = tasks.filter((task) => task.status === "Aberta");
  const overdueTasks = openTasks.filter((task) => task.dueAt.slice(0, 10) < new Date().toISOString().slice(0, 10)).slice(0, 6);
  return <div className="crm-layout">
    <aside className="crm-sidebar"><div className="crm-sidebar-brand"><span className="brand-mark">RS</span><div><strong>Mapa de Agências</strong><small>Consulta e acompanhamento</small></div></div><nav aria-label="Menu de consulta"><span className="crm-nav-label">Workspace</span><Link className="crm-nav-active" href="/dashboard">Dashboard</Link><Link href="/mapa">Mapa regional</Link><Link href="/agencias">Agências</Link><Link href="/acompanhamento">Acompanhamento</Link><Link href="/relatorios">Relatórios</Link><span className="crm-nav-label">Gestão</span><Link href="/usuarios">Usuários e permissões</Link><Link href="/importar">Importar base</Link><Link href="/admin">Painel administrativo</Link></nav><div className="crm-sidebar-note"><span>Diretório completo</span><strong>{metrics.total.toLocaleString("pt-BR")}</strong><small>{agencies.filter((agency) => agency.agencyKind === "exchange").length} intercâmbio · {agencies.filter((agency) => agency.agencyKind === "tourism").length.toLocaleString("pt-BR")} turismo</small></div></aside>
    <section className="crm-content"><header className="crm-heading"><div><span className="eyebrow">Acompanhamento · RS</span><h1>Bom dia, equipe.</h1><p>Uma visão simples para entender o estado das fichas, registrar contatos e organizar as próximas ações.</p></div><Link className="button primary" href="/acompanhamento">Abrir acompanhamento <span>↗</span></Link></header>
      <div className="dashboard-actions"><Link href="/acompanhamento?status=Dados%20incompletos">Revisar fichas incompletas <span>→</span></Link><Link href="/acompanhamento?overdue=1">Ações vencidas <b>{metrics.overdue}</b></Link><Link href="/admin">Cadastrar agência <span>＋</span></Link><Link href="/acompanhamento">Registrar contato <span>＋</span></Link></div>
      <div className="metric-grid"><Metric label="Agências no mapa" value={metrics.total.toLocaleString("pt-BR")} hint="Intercâmbio e turismo" /><Metric label="Ainda não analisadas" value={metrics.notAnalyzed} hint={`${metrics.incomplete} com dados incompletos`} tone="alert" /><Metric label="Prontas para contato" value={metrics.ready} hint="Informações essenciais preenchidas" tone="good" /><Metric label="Contatos realizados" value={metrics.contacted} hint={`${metrics.awaitingReply} aguardando retorno`} /><Metric label="Reuniões agendadas" value={metrics.meetings} hint={`${metrics.visitsPlanned} visitas planejadas`} tone="good" /><Metric label="Ações vencidas" value={metrics.overdue} hint={`${openTasks.length} ações abertas`} tone={metrics.overdue ? "alert" : "normal"} /></div>
      <div className="dashboard-grid"><BarChart title="Agências por cidade" items={by("city")} /><BarChart title="Agências por região" items={by("region")} tone="red" /><BarChart title="Status de acompanhamento" items={byStatus} tone="green" /></div>
      <div className="dashboard-lower"><section className="dashboard-list"><div className="dashboard-list-head"><div><span className="eyebrow">Dados</span><h2>Fichas que pedem revisão</h2></div><Link href="/acompanhamento">Ver todas →</Link></div>{agencies.filter((agency) => agency.completeness < 100).slice(0, 6).map((agency) => <Link className="priority-row" href={agency.agencyKind === "tourism" ? `/turismo/${agency.id.replace("tourism:", "")}` : `/agencias/${agency.slug}`} key={agency.id}><span className="score-badge">{agency.completeness}%</span><span><strong>{agency.tradeName}</strong><small>{agency.city} · faltam {agency.missingFields.slice(0, 2).join(" e ")}</small></span><b>Revisar →</b></Link>)}</section><section className="dashboard-list"><div className="dashboard-list-head"><div><span className="eyebrow">Agenda</span><h2>Ações vencidas</h2></div><Link href="/acompanhamento">Abrir lista →</Link></div>{overdueTasks.length ? overdueTasks.map((task) => <Link className="task-row" href="/acompanhamento" key={task.id}><span className="task-date">{task.dueAt.slice(0, 10)}</span><span><strong>{task.title}</strong><small>{task.agencyName} · {task.activityType}</small></span><b>Resolver →</b></Link>) : <p className="dashboard-empty">Nenhuma ação vencida.</p>}</section></div>
    </section>
  </div>;
}

