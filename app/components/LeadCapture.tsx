"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { Agency } from "@/lib/types";
import { trackEvent } from "@/lib/analytics";

const initialForm = { name: "", whatsapp: "", email: "", city: "", destination: "", exchangeType: "", budgetRange: "", travelDate: "", duration: "", travelerAge: "", notes: "", consent: false };

export default function LeadCapture() {
  const [form, setForm] = useState(initialForm);
  const [matches, setMatches] = useState<Agency[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  function update(key: keyof typeof initialForm, value: string | boolean) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage(""); setMatches([]); trackEvent("formulario_enviado", { source: "public-lead" });
    const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const payload = await response.json() as { error?: string; matches?: Agency[] };
    if (!response.ok) { setMessage(payload.error ?? "Não foi possível enviar seu pedido."); setLoading(false); return; }
    setMatches(payload.matches ?? []); trackEvent("lead_gerado", { matches: payload.matches?.length ?? 0 }); setMessage("Recebemos seu pedido. Estas agências têm perfil compatível com o que você procura."); setLoading(false);
  }
  return <div className="lead-shell">
    <header className="lead-heading"><div><span className="eyebrow">Atendimento público · RS</span><h1>Encontre a agência de intercâmbio ideal.</h1><p>Conte um pouco sobre seu plano. Usaremos apenas os dados autorizados para indicar agências compatíveis no Rio Grande do Sul.</p></div><Link className="inline-link" href="/agencias">Explorar o diretório <span>→</span></Link></header>
    <div className="lead-grid"><form className="lead-form" onSubmit={submit}>
      <fieldset><legend>Como podemos te encontrar?</legend><div className="form-grid"><label><span>Nome</span><input required value={form.name} onChange={(e) => update("name", e.target.value)} /></label><label><span>WhatsApp</span><input required type="tel" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="(51) 99999-9999" /></label><label><span>E-mail</span><input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></label><label><span>Cidade</span><input required value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Porto Alegre" /></label></div></fieldset>
      <fieldset><legend>Seu plano de intercâmbio</legend><div className="form-grid"><label><span>Destino desejado</span><input required value={form.destination} onChange={(e) => update("destination", e.target.value)} placeholder="Canadá, Irlanda…" /></label><label><span>Tipo de intercâmbio</span><select required value={form.exchangeType} onChange={(e) => update("exchangeType", e.target.value)}><option value="">Selecione</option><option>Curso de idiomas</option><option>High School</option><option>Graduação</option><option>Pós-graduação</option><option>Work and Travel</option><option>Au Pair</option><option>Estudo + trabalho</option><option>Outro</option></select></label><label><span>Faixa de investimento</span><select value={form.budgetRange} onChange={(e) => update("budgetRange", e.target.value)}><option value="">Prefiro não informar</option><option>Até R$ 15 mil</option><option>R$ 15–30 mil</option><option>R$ 30–60 mil</option><option>Acima de R$ 60 mil</option></select></label><label><span>Idade do viajante</span><input type="number" min="0" max="120" value={form.travelerAge} onChange={(e) => update("travelerAge", e.target.value)} /></label><label><span>Data estimada</span><input type="month" value={form.travelDate} onChange={(e) => update("travelDate", e.target.value)} /></label><label><span>Duração pretendida</span><input value={form.duration} onChange={(e) => update("duration", e.target.value)} placeholder="Ex.: 4 semanas" /></label></div><label className="wide-label"><span>Observações</span><textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Preferências, nível de idioma ou dúvidas…" /></label></fieldset>
      <label className="consent-check"><input required type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} /><span>Autorizo o contato para receber indicações relacionadas ao meu pedido e concordo com o tratamento desses dados para essa finalidade.</span></label>
      <button className="button primary" disabled={loading}>{loading ? "Encontrando agências…" : "Encontrar agências compatíveis"}<span>↗</span></button><p className="lead-privacy">Não vendemos seus dados. O pedido fica registrado com origem e consentimento para atendimento.</p>
    </form><aside className="lead-aside"><span className="eyebrow">Como funciona</span><ol><li><b>Você conta o plano</b><span>Preencha destino, tipo de programa e momento da viagem.</span></li><li><b>O mapa cruza os perfis</b><span>Comparamos cidade, destinos e serviços publicados pelas agências.</span></li><li><b>Você escolhe o próximo passo</b><span>Veja contatos públicos e fale diretamente com quem fizer sentido.</span></li></ol>{message && <div className={`lead-message${matches.length ? " success" : ""}`}>{message}</div>}</aside></div>
    {matches.length > 0 && <section className="lead-matches"><div><span className="eyebrow">Indicações encontradas</span><h2>Agências que podem ajudar</h2></div><div className="lead-match-grid">{matches.map((agency) => <article key={agency.id}><h3>{agency.tradeName}</h3><p>{agency.city} · {agency.region}</p><small>{agency.audienceProfile}</small><div>{agency.phone && <a href={`tel:${agency.phone.replace(/\D/g, "")}`}>Ligar</a>}{agency.website && <a href={/^https?:\/\//i.test(agency.website) ? agency.website : `https://${agency.website}`} target="_blank" rel="noreferrer">Site ↗</a>}</div></article>)}</div></section>}
  </div>;
}
