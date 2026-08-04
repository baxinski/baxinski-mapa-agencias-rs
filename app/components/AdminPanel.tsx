"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { commercialStatuses, type Agency, type ContactRecord } from "@/lib/types";

const emptyAgency: Partial<Agency> = { tradeName: "", legalName: "", city: "", region: "Metropolitana", state: "RS", neighborhood: "", cep: "", address: "", phone: "", whatsapp: "", email: "", website: "", instagram: "", facebook: "", linkedin: "", network: "", directors: "", owners: "", commercialManager: "", exchangeLead: "", programs: [], destinations: [], exchangeTypes: [], belta: null, units: 1, audienceProfile: "", commercialPotential: "C", commercialStatus: "Não contatada", assignedTo: "", estimatedValue: null, googleRating: null, googleReviewCount: null, isFranchise: null, description: "", hours: "", logoUrl: "", competitors: "", productsOfInterest: "", needs: "", notes: "", verificationStatus: "Revisar", sourceUrl: "", sourceLabel: "", verifiedAt: "" };

const inputFields: Array<[keyof Agency, string, string]> = [
  ["tradeName", "Nome fantasia", "text"], ["legalName", "Razão social", "text"], ["city", "Cidade", "text"], ["region", "Região", "text"],
  ["address", "Endereço", "text"], ["phone", "Telefone", "tel"], ["email", "E-mail", "email"], ["website", "Site", "url"],
  ["instagram", "Instagram", "url"], ["linkedin", "LinkedIn", "url"], ["directors", "Diretores", "text"], ["owners", "Proprietários", "text"],
  ["commercialManager", "Gerente comercial", "text"], ["exchangeLead", "Responsável pelo intercâmbio", "text"], ["audienceProfile", "Perfil de público", "text"],
  ["sourceUrl", "URL da fonte", "url"], ["sourceLabel", "Nome da fonte", "text"], ["verifiedAt", "Data de verificação", "date"],
];

export default function AdminPanel() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<Partial<Agency>>(emptyAgency);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [contactForm, setContactForm] = useState({ contactDate: new Date().toISOString().slice(0, 10), channel: "Telefone", contactName: "", summary: "", nextStep: "" });

  const load = () => fetch("/api/agencies").then(async (r) => await r.json() as Agency[]).then((items) => {
    setAgencies(items);
    const wanted = new URLSearchParams(window.location.search).get("agency");
    if (!selectedId && wanted && items.some((a) => a.id === wanted)) selectAgency(items.find((a) => a.id === wanted)!);
  });
  useEffect(() => { load(); }, []);
  const visible = useMemo(() => agencies.filter((a) => `${a.tradeName} ${a.city}`.toLowerCase().includes(query.toLowerCase())), [agencies, query]);

  function selectAgency(agency: Agency) {
    setSelectedId(agency.id); setForm(agency); setMessage("");
    fetch(`/api/contacts?agencyId=${agency.id}`).then(async (r) => await r.json() as ContactRecord[]).then(setContacts);
  }

  function newAgency() { setSelectedId(""); setForm({ ...emptyAgency }); setContacts([]); setMessage(""); }
  function update(key: keyof Agency, value: unknown) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("Salvando…");
    const response = await fetch(selectedId ? `/api/agencies/${selectedId}` : "/api/agencies", { method: selectedId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!response.ok) { const error = await response.json() as { error?: string }; setMessage(error.error || "Não foi possível salvar."); return; }
    const saved = await response.json() as Agency; setSelectedId(saved.id); setForm(saved); setMessage("Alterações salvas."); await load();
  }

  async function addHistory(event: FormEvent) {
    event.preventDefault(); if (!selectedId || !contactForm.summary) return;
    const response = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...contactForm, agencyId: selectedId }) });
    if (response.ok) {
      setContacts(await fetch(`/api/contacts?agencyId=${selectedId}`).then(async (r) => await r.json() as ContactRecord[]));
      setContactForm((current) => ({ ...current, contactName: "", summary: "", nextStep: "" }));
    }
  }

  return <div className="admin-layout">
    <aside className="admin-sidebar">
      <div className="admin-sidebar-head"><div><span className="eyebrow">Cadastro</span><h2>Agências</h2></div><button onClick={newAgency} className="icon-button" aria-label="Nova agência">＋</button></div>
      <input className="sidebar-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar na base" aria-label="Buscar no painel" />
      <div className="admin-agency-list">{visible.map((agency) => <button key={agency.id} onClick={() => selectAgency(agency)} className={selectedId === agency.id ? "active" : ""}><span className={`grade grade-${agency.commercialPotential}`}>{agency.commercialPotential}</span><span><strong>{agency.tradeName}</strong><small>{agency.city}</small></span></button>)}</div>
    </aside>
    <div className="admin-content">
      <div className="admin-title"><div><span className="eyebrow">{selectedId ? "Editar ficha" : "Novo cadastro"}</span><h1>{form.tradeName || "Nova agência"}</h1></div><div className="save-status">{message}</div></div>
      <form onSubmit={submit} className="admin-form">
        <fieldset><legend>Identificação e contato</legend><div className="form-grid">{inputFields.slice(0, 10).map(([key, label, type]) => <label key={key}><span>{label}</span><input required={["tradeName", "city", "region"].includes(key)} type={type} value={String(form[key] ?? "")} onChange={(e) => update(key, e.target.value)} /></label>)}</div></fieldset>
        <fieldset><legend>Equipe e perfil comercial</legend><div className="form-grid">{inputFields.slice(10, 15).map(([key, label, type]) => <label key={key}><span>{label}</span><input type={type} value={String(form[key] ?? "")} onChange={(e) => update(key, e.target.value)} /></label>)}<label><span>Potencial</span><select value={form.commercialPotential} onChange={(e) => update("commercialPotential", e.target.value)}><option>A</option><option>B</option><option>C</option></select></label><label><span>Número de unidades</span><input type="number" min="1" value={form.units ?? 1} onChange={(e) => update("units", Number(e.target.value))} /></label><label><span>Associação BELTA</span><select value={form.belta === null ? "" : form.belta ? "sim" : "nao"} onChange={(e) => update("belta", e.target.value === "" ? null : e.target.value === "sim")}><option value="">Não verificado</option><option value="sim">Confirmada</option><option value="nao">Não identificada</option></select></label></div><label className="wide-label"><span>Programas oferecidos (separados por vírgula)</span><input value={(form.programs ?? []).join(", ")} onChange={(e) => update("programs", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label></fieldset>
        <fieldset><legend>CRM e descoberta comercial</legend><div className="form-grid"><label><span>Status comercial</span><select value={form.commercialStatus ?? "Não contatada"} onChange={(e) => update("commercialStatus", e.target.value)}>{commercialStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label><span>Responsável</span><input value={form.assignedTo ?? ""} onChange={(e) => update("assignedTo", e.target.value)} /></label><label><span>Estado</span><input value={form.state ?? "RS"} onChange={(e) => update("state", e.target.value)} /></label><label><span>Bairro</span><input value={form.neighborhood ?? ""} onChange={(e) => update("neighborhood", e.target.value)} /></label><label><span>CEP</span><input value={form.cep ?? ""} onChange={(e) => update("cep", e.target.value)} /></label><label><span>WhatsApp</span><input type="tel" value={form.whatsapp ?? ""} onChange={(e) => update("whatsapp", e.target.value)} /></label><label><span>Facebook</span><input type="url" value={form.facebook ?? ""} onChange={(e) => update("facebook", e.target.value)} /></label><label><span>Rede ou grupo</span><input value={form.network ?? ""} onChange={(e) => update("network", e.target.value)} /></label><label><span>Horário de funcionamento</span><input value={form.hours ?? ""} onChange={(e) => update("hours", e.target.value)} /></label><label><span>Valor estimado (R$)</span><input type="number" min="0" step="0.01" value={form.estimatedValue ?? ""} onChange={(e) => update("estimatedValue", e.target.value === "" ? null : Number(e.target.value))} /></label><label><span>Nota no Google</span><input type="number" min="0" max="5" step="0.1" value={form.googleRating ?? ""} onChange={(e) => update("googleRating", e.target.value === "" ? null : Number(e.target.value))} /></label><label><span>Avaliações no Google</span><input type="number" min="0" value={form.googleReviewCount ?? ""} onChange={(e) => update("googleReviewCount", e.target.value === "" ? null : Number(e.target.value))} /></label><label><span>Perfil</span><select value={form.isFranchise == null ? "" : form.isFranchise ? "franquia" : "independente"} onChange={(e) => update("isFranchise", e.target.value === "" ? null : e.target.value === "franquia")}><option value="">Não informado</option><option value="independente">Independente</option><option value="franquia">Franquia</option></select></label></div><label className="wide-label"><span>Destinos principais (separados por vírgula)</span><input value={(form.destinations ?? []).join(", ")} onChange={(e) => update("destinations", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label><label className="wide-label"><span>Tipos de intercâmbio (separados por vírgula)</span><input value={(form.exchangeTypes ?? []).join(", ")} onChange={(e) => update("exchangeTypes", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label><label className="wide-label"><span>Descrição pública</span><textarea value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} rows={3} /></label><label className="wide-label"><span>Concorrentes identificados</span><input value={form.competitors ?? ""} onChange={(e) => update("competitors", e.target.value)} /></label><label className="wide-label"><span>Produtos de interesse</span><input value={form.productsOfInterest ?? ""} onChange={(e) => update("productsOfInterest", e.target.value)} /></label><label className="wide-label"><span>Necessidades identificadas</span><input value={form.needs ?? ""} onChange={(e) => update("needs", e.target.value)} /></label><label className="wide-label"><span>Observações internas</span><textarea value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={4} /></label></fieldset>
        <fieldset><legend>Fonte e verificação</legend><div className="form-grid">{inputFields.slice(15).map(([key, label, type]) => <label key={key}><span>{label}</span><input type={type} value={String(form[key] ?? "")} onChange={(e) => update(key, e.target.value)} /></label>)}<label><span>Status</span><select value={form.verificationStatus} onChange={(e) => update("verificationStatus", e.target.value)}><option>Verificado</option><option>Revisar</option></select></label></div></fieldset>
        <button type="submit" className="button primary save-button">{selectedId ? "Salvar alterações" : "Cadastrar agência"}</button>
      </form>

      {selectedId && <section className="history-section"><div className="history-head"><div><span className="eyebrow">Relacionamento</span><h2>Histórico de contatos</h2></div><span>{contacts.length} registro{contacts.length === 1 ? "" : "s"}</span></div>
        <form className="contact-form" onSubmit={addHistory}><input type="date" value={contactForm.contactDate} onChange={(e) => setContactForm({ ...contactForm, contactDate: e.target.value })} /><select value={contactForm.channel} onChange={(e) => setContactForm({ ...contactForm, channel: e.target.value })}><option>Telefone</option><option>E-mail</option><option>WhatsApp</option><option>Visita</option><option>LinkedIn</option></select><input placeholder="Pessoa contatada" value={contactForm.contactName} onChange={(e) => setContactForm({ ...contactForm, contactName: e.target.value })} /><input className="contact-summary" required placeholder="Resumo da conversa" value={contactForm.summary} onChange={(e) => setContactForm({ ...contactForm, summary: e.target.value })} /><input className="contact-summary" placeholder="Próximo passo" value={contactForm.nextStep} onChange={(e) => setContactForm({ ...contactForm, nextStep: e.target.value })} /><button className="button dark">Registrar contato</button></form>
        <div className="timeline">{contacts.map((contact) => <article key={contact.id}><span className="timeline-dot" /><div><small>{contact.contactDate} · {contact.channel}</small><strong>{contact.contactName || "Contato sem nome"}</strong><p>{contact.summary}</p>{contact.nextStep && <em>Próximo: {contact.nextStep}</em>}</div></article>)}{contacts.length === 0 && <p className="timeline-empty">Nenhum contato registrado. Use o formulário acima para iniciar o histórico.</p>}</div>
      </section>}
    </div>
  </div>;
}
