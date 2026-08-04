"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AgencyPlan, AgencySubscription } from "@/lib/types";

export default function PlansWorkspace() {
  const [plans, setPlans] = useState<AgencyPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<AgencySubscription[]>([]);
  const [internal, setInternal] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/planos").then(async (response) => await response.json() as AgencyPlan[] | { plans: AgencyPlan[]; subscriptions: AgencySubscription[] }).then((data) => { if (Array.isArray(data)) setPlans(data); else { setInternal(true); setPlans(data.plans); setSubscriptions(data.subscriptions); } }); }, 0); return () => window.clearTimeout(timer); }, []);
  return <div className="workspace-shell"><header className="workspace-heading"><div><span className="eyebrow">Estrutura comercial</span><h1>Planos para agências</h1><p>Catálogo preparado para perfis verificados, destaques regionais e distribuição futura de leads. Nenhuma cobrança é ativada sem um provedor configurado.</p></div><Link className="inline-link" href={internal ? "/dashboard" : "/encontrar-agencia"}>{internal ? "Voltar ao dashboard" : "Encontrar uma agência"} <span>→</span></Link></header><div className="plan-grid">{plans.map((plan) => <article className="plan-card" key={plan.id}><span className="eyebrow">{plan.code}</span><h2>{plan.name}</h2><p>{plan.description}</p><strong>{plan.monthlyPrice == null ? "Sob consulta" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.monthlyPrice)}<small>{plan.monthlyPrice == null ? "" : " / mês"}</small></strong><ul>{(plan.features.length ? plan.features : ["Cadastro e presença no diretório", "Dados públicos rastreáveis", "Atendimento comercial"]).map((feature) => <li key={feature}>{feature}</li>)}</ul></article>)}</div>{internal && <section className="workspace-card subscription-list"><div className="report-card-head"><div><span className="eyebrow">Operação</span><h2>Assinaturas cadastradas</h2></div><span>{subscriptions.length} registros</span></div>{subscriptions.length ? subscriptions.map((item) => <article key={item.id}><strong>{item.agencyName ?? item.agencyId}</strong><span>{item.planName ?? item.planId} · {item.status}</span></article>) : <p className="report-empty">Nenhum plano foi atribuído ainda.</p>}</section>}</div>;
}
