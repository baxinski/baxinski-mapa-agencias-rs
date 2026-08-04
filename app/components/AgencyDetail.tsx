"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Agency, CommercialStatus, ContactRecord, StatusHistoryRecord, TaskPriority } from "@/lib/types";
import { commercialStatuses } from "@/lib/types";
import { scoreLabel } from "@/lib/scoring";
import { trackEvent } from "@/lib/analytics";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="detail-field"><dt>{label}</dt><dd>{value || <span className="pending">Não informado</span>}</dd></div>;
}

function statusClass(status: string) { return status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"); }
function digits(value: string | null | undefined) { return (value ?? "").replace(/\D/g, ""); }

export default function AgencyDetail({ slug }: { slug: string }) {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [history, setHistory] = useState<StatusHistoryRecord[]>([]);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [contactForm, setContactForm] = useState({ interactionType: "Ligação", summary: "", result: "", nextStep: "", nextContactAt: "" });
  const [taskForm, setTaskForm] = useState({ title: "", dueAt: "", priority: "Média" as TaskPriority, activityType: "Follow-up" });

  function load() {
    return fetch(`/api/agencies/${slug}`).then(async (response) => { if (!response.ok) throw new Error(); return await response.json() as Agency; }).then((item) => {
      setAgency(item);
      trackEvent("visualizacao_agencia", { agencyId: item.id });
      return Promise.all([
        fetch(`/api/contacts?agencyId=${item.id}`).then(async (response) => response.ok ? await response.json() as ContactRecord[] : []),
        fetch(`/api/status-history?agencyId=${item.id}`).then(async (response) => response.ok ? await response.json() as StatusHistoryRecord[] : []),
      ]).then(([nextContacts, nextHistory]) => { setContacts(nextContacts); setHistory(nextHistory); });
    }).catch(() => setMissing(true));
  }
  useEffect(() => { void load(); }, [slug]);
  if (missing) return <div className="empty-state"><strong>Ficha não encontrada.</strong><p><Link href="/agencias">Voltar ao diretório</Link></p></div>;
  if (!agency) return <div className="loading-panel">Carregando ficha…</div>;
  const agencyId = agency.id;

  async function changeStatus(value: CommercialStatus) {
    setMessage("Atualizando status…");
    const response = await fetch(`/api/agencies/${agencyId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commercialStatus: value }) });
    if (response.ok) { setMessage("Status atualizado."); await load(); } else setMessage("Não foi possível atualizar o status.");
  }
  async function submitContact(event: FormEvent) {
    event.preventDefault(); if (!contactForm.summary) return;
    setMessage("Registrando contato…");
    const response = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyId: agencyId, channel: contactForm.interactionType, ...contactForm }) });
    if (response.ok) { trackEvent("contato_registrado", { agencyId }); setContactForm({ interactionType: "Ligação", summary: "", result: "", nextStep: "", nextContactAt: "" }); setMessage("Contato registrado no histórico."); await load(); } else setMessage("Não foi possível registrar o contato.");
  }
  async function submitTask(event: FormEvent) {
    event.preventDefault(); if (!taskForm.title || !taskForm.dueAt) return;
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyId: agencyId, ...taskForm }) });
    if (response.ok) { setTaskForm({ title: "", dueAt: "", priority: "Média", activityType: "Follow-up" }); setMessage("Follow-up agendado."); await load(); } else setMessage("Não foi possível agendar o follow-up.");
  }
  const phone = agency.phone || agency.whatsapp;
  const whatsappNumber = digits(agency.whatsapp || agency.phone);
  const currentScore = agency.opportunityScore ?? 0;
  return <>
    <div className="detail-hero">
      <Link href="/agencias" className="back-link">← Diretório de intercâmbio</Link>
      <div className="detail-title"><div><span className="eyebrow">{agency.city} · {agency.region}</span><h1>{agency.tradeName}</h1><p>{agency.audienceProfile}</p></div><div className="detail-title-badges"><span className={`crm-status crm-status-${statusClass(agency.commercialStatus ?? "Não contatada")}`}>{agency.commercialStatus ?? "Não contatada"}</span><span className="score-badge score-large">{currentScore}</span></div></div>
    </div>
    <div className="detail-layout">
      <div className="detail-main">
        <section className="detail-section"><div className="section-number">01</div><div><h2>Dados da agência</h2><dl className="detail-grid"><Field label="Razão social" value={agency.legalName} /><Field label="Nome fantasia" value={agency.tradeName} /><Field label="Estado" value={agency.state ?? "RS"} /><Field label="Região" value={agency.region} /><Field label="Bairro" value={agency.neighborhood} /><Field label="Endereço" value={agency.address} /><Field label="CEP" value={agency.cep} /><Field label="Telefone" value={agency.phone} /><Field label="WhatsApp" value={agency.whatsapp} /><Field label="E-mail" value={agency.email} /><Field label="Site" value={agency.website} /><Field label="Instagram" value={agency.instagram} /><Field label="Facebook" value={agency.facebook} /><Field label="LinkedIn" value={agency.linkedin} /><Field label="Horário de funcionamento" value={agency.hours} /><Field label="Unidades no RS" value={agency.units} /><Field label="Rede ou grupo" value={agency.network} /><Field label="Nota no Google" value={agency.googleRating == null ? null : `${agency.googleRating.toFixed(1)} · ${agency.googleReviewCount ?? 0} avaliações`} /><Field label="Latitude / longitude" value={agency.latitude == null || agency.longitude == null ? null : `${agency.latitude}, ${agency.longitude}`} /><Field label="Franquia ou independente" value={agency.isFranchise == null ? null : agency.isFranchise ? "Franquia" : "Independente"} /></dl></div></section>
        <section className="detail-section"><div className="section-number">02</div><div><h2>Oferta e perfil</h2><div className="program-list">{(agency.programs ?? []).map((item) => <span key={item}>{item}</span>)}</div><dl className="detail-grid compact"><Field label="Perfil de público" value={agency.audienceProfile} /><Field label="Destinos" value={(agency.destinations ?? []).join(", ")} /><Field label="Tipos de intercâmbio" value={(agency.exchangeTypes ?? []).join(", ")} /><Field label="Associação BELTA" value={agency.belta === null ? null : agency.belta ? "Confirmada" : "Não identificada"} /><Field label="Descrição" value={agency.description} /></dl></div></section>
        <section className="detail-section"><div className="section-number">03</div><div><div className="section-heading-row"><h2>Operação comercial</h2><span className={`potential potential-${agency.commercialPotential}`}>Potencial {agency.commercialPotential}</span></div><dl className="detail-grid"><Field label="Pontuação de oportunidade" value={`${currentScore}/100 · ${scoreLabel(currentScore)}`} /><Field label="Responsável" value={agency.assignedTo} /><Field label="Valor estimado" value={agency.estimatedValue == null ? null : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(agency.estimatedValue)} /><Field label="Primeiro contato" value={agency.firstContactAt} /><Field label="Último contato" value={agency.lastContactAt} /><Field label="Próximo follow-up" value={agency.nextFollowUpAt} /><Field label="Motivo de perda" value={agency.lossReason} /><Field label="Concorrentes identificados" value={agency.competitors} /><Field label="Produtos de interesse" value={agency.productsOfInterest} /><Field label="Necessidades identificadas" value={agency.needs} /></dl><label className="status-editor"><span>Status comercial</span><select value={agency.commercialStatus ?? "Não contatada"} onChange={(event) => changeStatus(event.target.value as CommercialStatus)}>{commercialStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></div></section>
        <section className="detail-section"><div className="section-number">04</div><div><h2>Registrar interação</h2><form className="detail-action-form" onSubmit={submitContact}><select value={contactForm.interactionType} onChange={(event) => setContactForm({ ...contactForm, interactionType: event.target.value })}><option>Ligação</option><option>WhatsApp</option><option>E-mail</option><option>Reunião</option><option>Visita</option><option>Videoconferência</option><option>Proposta</option><option>Follow-up</option><option>Observação</option></select><input required placeholder="Resumo da interação" value={contactForm.summary} onChange={(event) => setContactForm({ ...contactForm, summary: event.target.value })} /><input placeholder="Resultado" value={contactForm.result} onChange={(event) => setContactForm({ ...contactForm, result: event.target.value })} /><input placeholder="Próxima ação" value={contactForm.nextStep} onChange={(event) => setContactForm({ ...contactForm, nextStep: event.target.value })} /><input type="date" value={contactForm.nextContactAt} onChange={(event) => setContactForm({ ...contactForm, nextContactAt: event.target.value })} /><button className="button dark">Salvar contato</button></form><div className="activity-timeline">{contacts.map((contact) => <article key={contact.id}><span className="timeline-dot" /><div><small>{contact.contactDate} {contact.contactTime ? `· ${contact.contactTime}` : ""} · {contact.interactionType ?? contact.channel}</small><strong>{contact.contactName || "Interação registrada"}</strong><p>{contact.summary}</p>{contact.result && <em>Resultado: {contact.result}</em>}{contact.nextStep && <em>Próximo: {contact.nextStep}</em>}</div></article>)}{history.map((item) => <article key={item.id}><span className="timeline-dot timeline-status-dot" /><div><small>{new Date(item.changedAt).toLocaleString("pt-BR")} · Status</small><strong>{item.previousStatus ?? "Novo cadastro"} → {item.newStatus}</strong><p>{item.note || "Alteração registrada no histórico."}</p></div></article>)}{contacts.length === 0 && history.length === 0 && <p className="timeline-empty">Nenhuma interação registrada.</p>}</div></div></section>
        <section className="detail-section"><div className="section-number">05</div><div><h2>Agendar follow-up</h2><form className="detail-action-form task-inline-form" onSubmit={submitTask}><input required placeholder="Título da tarefa" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /><input required type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm({ ...taskForm, dueAt: event.target.value })} /><select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as TaskPriority })}><option>Baixa</option><option>Média</option><option>Alta</option><option>Urgente</option></select><select value={taskForm.activityType} onChange={(event) => setTaskForm({ ...taskForm, activityType: event.target.value })}><option>Follow-up</option><option>Ligação</option><option>WhatsApp</option><option>E-mail</option><option>Reunião</option></select><button className="button primary">Agendar</button></form><p className="save-status">{message}</p></div></section>
        <section className="detail-section"><div className="section-number">06</div><div><h2>Observações internas</h2><p className="note-box">{agency.notes || "Sem observações registradas."}</p></div></section>
      </div>
      <aside className="source-card"><span className="verified-stamp">✓ Dado rastreável</span><h2>Ações rápidas</h2><div className="quick-actions">{whatsappNumber && <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">Chamar no WhatsApp ↗</a>}{phone && <a href={`tel:${digits(phone)}`}>Ligar · {phone}</a>}{agency.email && <a href={`mailto:${agency.email}`}>Enviar e-mail</a>}{agency.website && <a href={agency.website} target="_blank" rel="noreferrer">Abrir site ↗</a>}{agency.instagram && <a href={agency.instagram} target="_blank" rel="noreferrer">Abrir Instagram ↗</a>}{agency.facebook && <a href={agency.facebook} target="_blank" rel="noreferrer">Abrir Facebook ↗</a>}{agency.latitude != null && agency.longitude != null && <a href={`https://www.google.com/maps/search/?api=1&query=${agency.latitude},${agency.longitude}`} target="_blank" rel="noreferrer">Ver localização ↗</a>}</div><h2>Fonte pública</h2><p>{agency.sourceLabel || "Fonte não cadastrada"}</p>{agency.sourceUrl && <a href={agency.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>}<dl><Field label="Verificado em" value={agency.verifiedAt} /><Field label="Última edição" value={agency.updatedAt} /></dl><Link href={`/admin?agency=${agency.id}`} className="button primary full">Editar agência</Link></aside>
    </div>
  </>;
}
