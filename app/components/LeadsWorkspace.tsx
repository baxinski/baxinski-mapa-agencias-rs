"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LeadRecord } from "@/lib/types";

const statuses: LeadRecord["status"][] = ["Novo", "Em atendimento", "Distribuído", "Convertido", "Arquivado"];
export default function LeadsWorkspace() {
  const [leads, setLeads] = useState<LeadRecord[]>([]); const [error, setError] = useState("");
  async function load() { const response = await fetch("/api/leads"); if (response.ok) setLeads(await response.json() as LeadRecord[]); else setError("Você não possui permissão para consultar os leads."); }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function changeStatus(lead: LeadRecord, status: LeadRecord["status"]) { await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, status }) }); await load(); }
  return <div className="workspace-shell"><header className="workspace-heading"><div><span className="eyebrow">Captação pública</span><h1>Leads recebidos</h1><p>Organize os pedidos enviados pelo formulário público, sem expor dados pessoais no diretório.</p></div><div className="workspace-heading-actions"><Link className="button primary" href="/encontrar-agencia">Abrir formulário público <span>↗</span></Link><Link className="inline-link" href="/dashboard">Dashboard <span>→</span></Link></div></header>{error ? <div className="empty-state">{error}</div> : <section className="lead-table"><div className="lead-table-head"><span>{leads.length} solicitações</span><small>Consentimento registrado no recebimento</small></div>{leads.map((lead) => <article key={lead.id}><div><strong>{lead.name}</strong><small>{lead.city} · {lead.destination} · {lead.exchangeType}</small></div><div><span>{lead.email}</span><small>{lead.whatsapp}</small></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(lead.createdAt))}</time><select value={lead.status} onChange={(e) => changeStatus(lead, e.target.value as LeadRecord["status"])}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></article>)}{leads.length === 0 && <p className="report-empty">Nenhum lead recebido ainda.</p>}</section>}</div>;
}
