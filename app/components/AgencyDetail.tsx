"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { AccompanimentChannel, AccompanimentPriority, AccompanimentStatus, Agency, ContactRecord, StatusHistoryRecord } from "@/lib/types";
import { accompanimentChannels, accompanimentPriorities, accompanimentStatuses } from "@/lib/types";
import { trackEvent } from "@/lib/analytics";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="detail-field"><dt>{label}</dt><dd>{value || <span className="pending">Não informado</span>}</dd></div>;
}
function digits(value: string | null | undefined) { return (value ?? "").replace(/\D/g, ""); }
function statusClass(status: string) { return status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"); }

export default function AgencyDetail({ slug }: { slug: string }) {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [history, setHistory] = useState<StatusHistoryRecord[]>([]);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [contactForm, setContactForm] = useState({ channel: "Telefone" as AccompanimentChannel, person: "", role: "", subject: "", information: "", result: "", nextAction: "", nextDate: "" });
  const [taskForm, setTaskForm] = useState({ title: "", dueAt: "", priority: "Média" as AccompanimentPriority, activityType: "Retorno" });

  async function load() {
    return fetch(`/api/agencies/${slug}`, { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(); return await response.json() as Agency; }).then(async (item) => {
      setAgency(item); trackEvent("visualizacao_agencia", { agencyId: item.id });
      const [nextContacts, nextHistory] = await Promise.all([
        fetch(`/api/contacts?agencyId=${item.id}`, { cache: "no-store" }).then(async (response) => response.ok ? await response.json() as ContactRecord[] : []),
        fetch(`/api/status-history?agencyId=${item.id}`, { cache: "no-store" }).then(async (response) => response.ok ? await response.json() as StatusHistoryRecord[] : []),
      ]);
      setContacts(nextContacts); setHistory(nextHistory);
    }).catch(() => setMissing(true));
  }
  useEffect(() => { void load(); }, [slug]);
  if (missing) return <div className="empty-state"><strong>Ficha não encontrada.</strong><p><Link href="/agencias">Voltar ao diretório</Link></p></div>;
  if (!agency) return <div className="loading-panel">Carregando ficha…</div>;
  const agencyId = agency.id;
  const status = agency.accompanimentStatus ?? "Não analisada";
  const priority = agency.accompanimentPriority ?? "Sem prioridade definida";
  const contactPerson = agency.primaryContactName ?? agency.directors ?? agency.owners ?? null;
  const phone = agency.phone || agency.whatsapp;
  const whatsappNumber = digits(agency.whatsapp || agency.phone);
  const completenessFields: Array<[string, boolean]> = [["Endereço", Boolean(agency.address)], ["Telefone", Boolean(agency.phone)], ["WhatsApp", Boolean(agency.whatsapp)], ["E-mail", Boolean(agency.email)], ["Site", Boolean(agency.website)], ["Instagram", Boolean(agency.instagram)], ["Programas", Boolean(agency.programs?.length)], ["Contato responsável", Boolean(contactPerson)], ["Observações", Boolean(agency.notes)]];
  const completeness = Math.round(completenessFields.filter(([, value]) => value).length / completenessFields.length * 100);

  async function update(fields: Record<string, unknown>, success: string) {
    setMessage("Salvando…");
    const response = await fetch(`/api/agencies/${agencyId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    if (response.ok) { setMessage(success); await load(); } else setMessage("Não foi possível salvar a atualização.");
  }
  async function submitContact(event: FormEvent) {
    event.preventDefault(); if (!contactForm.information.trim()) return;
    const response = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyId, channel: contactForm.channel, interactionType: contactForm.channel, contactName: contactForm.person || null, contactRole: contactForm.role || null, subject: contactForm.subject || null, informationObtained: contactForm.information, summary: contactForm.information, result: contactForm.result || null, nextStep: contactForm.nextAction || null, nextContactAt: contactForm.nextDate || null }) });
    if (response.ok) { trackEvent("contato_registrado", { agencyId }); setContactForm({ channel: "Telefone", person: "", role: "", subject: "", information: "", result: "", nextAction: "", nextDate: "" }); setMessage("Contato registrado no histórico."); await load(); } else setMessage("Não foi possível registrar o contato.");
  }
  async function submitTask(event: FormEvent) {
    event.preventDefault(); if (!taskForm.title || !taskForm.dueAt) return;
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyId, title: taskForm.title, dueAt: taskForm.dueAt, priority: taskForm.priority === "Sem prioridade definida" ? "Média" : taskForm.priority, activityType: taskForm.activityType }) });
    if (response.ok) { setTaskForm({ title: "", dueAt: "", priority: "Média", activityType: "Retorno" }); setMessage("Ação agendada."); await load(); } else setMessage("Não foi possível agendar a ação.");
  }
  return <>
    <div className="detail-hero"><Link href="/agencias" className="back-link">← Diretório de intercâmbio</Link><div className="detail-title"><div><span className="eyebrow">{agency.city} · {agency.region}</span><h1>{agency.tradeName}</h1><p>{agency.audienceProfile}</p></div><div className="detail-title-badges"><span className={`acomp-status acomp-${statusClass(status)}`}>{status}</span><span className="score-badge score-large">{completeness}%</span></div></div></div>
    <div className="detail-layout"><div className="detail-main">
      <section className="detail-section"><div className="section-number">01</div><div><h2>Dados da agência</h2><dl className="detail-grid"><Field label="Razão social" value={agency.legalName} /><Field label="Nome fantasia" value={agency.tradeName} /><Field label="Estado" value={agency.state ?? "RS"} /><Field label="Região" value={agency.region} /><Field label="Bairro" value={agency.neighborhood} /><Field label="Endereço" value={agency.address} /><Field label="CEP" value={agency.cep} /><Field label="Telefone" value={agency.phone} /><Field label="WhatsApp" value={agency.whatsapp} /><Field label="E-mail" value={agency.email} /><Field label="Site" value={agency.website} /><Field label="Instagram" value={agency.instagram} /><Field label="Facebook" value={agency.facebook} /><Field label="LinkedIn" value={agency.linkedin} /><Field label="Horário de funcionamento" value={agency.hours} /><Field label="Unidades no RS" value={agency.units} /><Field label="Rede ou grupo" value={agency.network} /><Field label="Latitude / longitude" value={agency.latitude == null || agency.longitude == null ? null : `${agency.latitude}, ${agency.longitude}`} /></dl></div></section>
      <section className="detail-section"><div className="section-number">02</div><div><h2>Oferta e perfil</h2><div className="program-list">{(agency.programs ?? []).map((item) => <span key={item}>{item}</span>)}</div><dl className="detail-grid compact"><Field label="Perfil de público" value={agency.audienceProfile} /><Field label="Destinos" value={(agency.destinations ?? []).join(", ")} /><Field label="Tipos de intercâmbio" value={(agency.exchangeTypes ?? []).join(", ")} /><Field label="Associação BELTA" value={agency.belta === null ? null : agency.belta ? "Confirmada" : "Não identificada"} /><Field label="Descrição" value={agency.description} /></dl></div></section>
      <section className="detail-section"><div className="section-number">03</div><div><div className="section-heading-row"><h2>Acompanhamento</h2><strong className="detail-completeness">{completeness}% da ficha preenchida</strong></div><dl className="detail-grid"><Field label="Pessoa de contato" value={contactPerson} /><Field label="Função / cargo" value={agency.primaryContactRole} /><Field label="Responsável interno" value={agency.assignedTo} /><Field label="Último contato" value={agency.lastContactAt} /><Field label="Próximo contato" value={agency.nextFollowUpAt} /><Field label="Próxima ação" value={agency.nextAction} /><Field label="Prioridade" value={priority} /></dl><div className="status-editor"><span>Status de acompanhamento</span><select value={status} onChange={(event) => void update({ accompanimentStatus: event.target.value as AccompanimentStatus }, "Status atualizado.")}>{accompanimentStatuses.map((item) => <option key={item}>{item}</option>)}</select></div><div className="status-editor"><span>Prioridade</span><select value={priority} onChange={(event) => void update({ accompanimentPriority: event.target.value as AccompanimentPriority }, "Prioridade atualizada.")}>{accompanimentPriorities.map((item) => <option key={item}>{item}</option>)}</select></div></div></section>
      <section className="detail-section"><div className="section-number">04</div><div><h2>Registrar interação</h2><form className="detail-action-form" onSubmit={submitContact}><select value={contactForm.channel} onChange={(event) => setContactForm({ ...contactForm, channel: event.target.value as AccompanimentChannel })}>{accompanimentChannels.map((item) => <option key={item}>{item}</option>)}</select><input placeholder="Pessoa contatada" value={contactForm.person} onChange={(event) => setContactForm({ ...contactForm, person: event.target.value })} /><input placeholder="Função / cargo" value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })} /><input required placeholder="Informações obtidas" value={contactForm.information} onChange={(event) => setContactForm({ ...contactForm, information: event.target.value })} /><input placeholder="Próxima ação" value={contactForm.nextAction} onChange={(event) => setContactForm({ ...contactForm, nextAction: event.target.value })} /><button className="button dark">Salvar contato</button></form><div className="activity-timeline">{contacts.map((contact) => <article key={contact.id}><span className="timeline-dot" /><div><small>{contact.contactDate} {contact.contactTime ? `· ${contact.contactTime}` : ""} · {contact.interactionType ?? contact.channel}</small><strong>{contact.contactName || "Interação registrada"}</strong><p>{contact.informationObtained ?? contact.summary}</p>{contact.result && <em>Resultado: {contact.result}</em>}{contact.nextStep && <em>Próximo: {contact.nextStep}</em>}</div></article>)}{history.map((item) => <article key={item.id}><span className="timeline-dot timeline-status-dot" /><div><small>{new Date(item.changedAt).toLocaleString("pt-BR")} · Status</small><strong>{item.previousStatus ?? "Novo cadastro"} → {item.newStatus}</strong><p>{item.note || "Alteração registrada no histórico."}</p></div></article>)}{contacts.length === 0 && history.length === 0 && <p className="timeline-empty">Nenhuma interação registrada.</p>}</div></div></section>
      <section className="detail-section"><div className="section-number">05</div><div><h2>Agendar follow-up</h2><form className="detail-action-form task-inline-form" onSubmit={submitTask}><input required placeholder="Título da ação" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /><input required type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm({ ...taskForm, dueAt: event.target.value })} /><select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as AccompanimentPriority })}>{accompanimentPriorities.slice(0, 3).map((item) => <option key={item}>{item}</option>)}</select><select value={taskForm.activityType} onChange={(event) => setTaskForm({ ...taskForm, activityType: event.target.value })}><option>Retorno</option><option>Reunião</option><option>Visita</option><option>Levantamento</option></select><button className="button primary">Agendar</button></form><p className="save-status">{message}</p></div></section>
      <section className="detail-section"><div className="section-number">06</div><div><h2>Checklist da ficha</h2><div className="checklist-grid">{completenessFields.map(([label, complete]) => <span className={complete ? "check-complete" : "check-missing"} key={label}>{complete ? "✓" : "○"} {label}</span>)}</div><p className="note-box">{agency.notes || "Sem observações registradas."}</p></div></section>
    </div><aside className="source-card"><span className="verified-stamp">✓ Dado rastreável</span><h2>Ações rápidas</h2><div className="quick-actions">{whatsappNumber && <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">Chamar no WhatsApp ↗</a>}{phone && <a href={`tel:${digits(phone)}`}>Ligar · {phone}</a>}{agency.email && <a href={`mailto:${agency.email}`}>Enviar e-mail</a>}{agency.website && <a href={agency.website} target="_blank" rel="noreferrer">Abrir site ↗</a>}{agency.instagram && <a href={agency.instagram} target="_blank" rel="noreferrer">Abrir Instagram ↗</a>}{agency.facebook && <a href={agency.facebook} target="_blank" rel="noreferrer">Abrir Facebook ↗</a>}{agency.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${agency.address}, ${agency.city}, RS`)}`} target="_blank" rel="noreferrer">Abrir no mapa ↗</a>}</div><h2>Fonte pública</h2><p>{agency.sourceLabel || "Fonte não cadastrada"}</p>{agency.sourceUrl && <a href={agency.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>}<dl><Field label="Verificado em" value={agency.verifiedAt} /><Field label="Última edição" value={agency.updatedAt} /></dl><Link href={`/admin?agency=${agency.id}`} className="button primary full">Editar agência</Link></aside></div>
  </>;
}

