"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { commercialStatuses, type Agency } from "@/lib/types";
import { scoreLabel } from "@/lib/scoring";

export default function AgencyDirectory() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Todas");
  const [profile, setProfile] = useState("Todos");
  const [potential, setPotential] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/agencies").then(async (r) => await r.json() as Agency[]).then((items) => { setAgencies(items); const initialStatus = new URLSearchParams(window.location.search).get("status"); if (initialStatus) setStatus(initialStatus); }).finally(() => setLoading(false)); }, []);
  const cities = useMemo(() => [...new Set(agencies.map((a) => a.city))].sort(), [agencies]);
  const profiles = useMemo(() => [...new Set(agencies.map((a) => a.audienceProfile.split(" · ")[0]))].sort(), [agencies]);
  const filtered = useMemo(() => agencies.filter((a) => {
    const haystack = [a.tradeName, a.city, a.audienceProfile, ...a.programs].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase()) && (city === "Todas" || a.city === city) &&
      (profile === "Todos" || a.audienceProfile.startsWith(profile)) &&
      (potential === "Todos" || a.commercialPotential === potential) &&
      (status === "Todos" || (a.commercialStatus ?? "Não contatada") === status);
  }), [agencies, query, city, profile, potential, status]);

  return (
    <>
      <div className="directory-tools agency-tools">
        <label className="search-field"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar agência, cidade ou programa" aria-label="Buscar agências" /></label>
        <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filtrar por cidade"><option>Todas</option>{cities.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={profile} onChange={(e) => setProfile(e.target.value)} aria-label="Filtrar por perfil"><option>Todos</option>{profiles.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status comercial"><option>Todos</option>{commercialStatuses.map((item) => <option key={item}>{item}</option>)}</select>
        <div className="segmented" aria-label="Filtrar por potencial">{["Todos", "A", "B", "C"].map((item) => <button key={item} onClick={() => setPotential(item)} className={potential === item ? "active" : ""}>{item}</button>)}</div>
      </div>
      <div className="results-meta"><span>{loading ? "Carregando base…" : `${filtered.length} de ${agencies.length} fichas`}</span><span>Fonte e verificação disponíveis em cada ficha</span><div className="directory-view-toggle" aria-label="Escolher visualização"><button type="button" className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}>Cartões</button><button type="button" className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Tabela</button></div></div>
      {view === "cards" ? <div className="agency-grid">
        {filtered.map((agency) => (
          <Link href={`/agencias/${agency.slug}`} className="agency-card" key={agency.id}>
            <div className="card-head"><span className={`potential potential-${agency.commercialPotential}`}>Potencial {agency.commercialPotential}</span><span className={`crm-status crm-status-${(agency.commercialStatus ?? "Não contatada").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`}>{agency.commercialStatus ?? "Não contatada"}</span></div>
            <h2>{agency.tradeName}</h2>
            <p className="location">{agency.city} <span>·</span> {agency.region}</p>
            <p className="profile">{agency.audienceProfile}</p>
            <div className="tag-row">{agency.programs.slice(0, 3).map((program) => <span key={program}>{program}</span>)}</div>
            <div className="card-foot"><span>{agency.opportunityScore ?? 0}/100 · {scoreLabel(agency.opportunityScore ?? 0)}</span><b>Ver ficha →</b></div>
          </Link>
        ))}
      </div> : <div className="agency-table-wrap"><table className="agency-table"><thead><tr><th>Agência</th><th>Cidade · região</th><th>Contato</th><th>Status</th><th>Score</th><th>Potencial</th><th>Próximo follow-up</th><th aria-label="Ações" /></tr></thead><tbody>{filtered.map((agency) => <tr key={agency.id}><td><Link href={`/agencias/${agency.slug}`} className="table-agency-name">{agency.tradeName}</Link><small>{agency.legalName || "Razão social não informada"}</small></td><td>{agency.city}<small>{agency.region}</small></td><td>{agency.phone || agency.whatsapp || "Não informado"}<small>{agency.email || ""}</small></td><td><span className={`crm-status crm-status-${(agency.commercialStatus ?? "Não contatada").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`}>{agency.commercialStatus ?? "Não contatada"}</span></td><td><span className="table-score">{agency.opportunityScore ?? 0}</span><small>{scoreLabel(agency.opportunityScore ?? 0)}</small></td><td><span className={`potential potential-${agency.commercialPotential}`}>{agency.commercialPotential}</span></td><td>{agency.nextFollowUpAt || "—"}</td><td><Link href={`/agencias/${agency.slug}`} className="table-action">Abrir →</Link></td></tr>)}</tbody></table></div>}
      {!loading && filtered.length === 0 && <div className="empty-state"><strong>Nenhuma ficha encontrada.</strong><p>Experimente retirar um filtro ou usar outro termo.</p></div>}
    </>
  );
}
