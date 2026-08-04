"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { commercialStatuses, type Agency } from "@/lib/types";
import { scoreLabel } from "@/lib/scoring";
import { trackEvent } from "@/lib/analytics";

type SavedFilter = { name: string; query: string; city: string; profile: string; potential: string; status: string; sort: string; availability: string; minScore: string };

export default function AgencyDirectory() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Todas");
  const [profile, setProfile] = useState("Todos");
  const [potential, setPotential] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [sort, setSort] = useState("score");
  const [availability, setAvailability] = useState("Todos");
  const [minScore, setMinScore] = useState("0");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/agencies").then(async (r) => await r.json() as Agency[]).then((items) => { setAgencies(items); const initial = new URLSearchParams(window.location.search); const initialStatus = initial.get("status"); if (initialStatus) setStatus(initialStatus); if (initial.get("potential")) setPotential(initial.get("potential")!); if (initial.get("city")) setCity(initial.get("city")!); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { const timer = window.setTimeout(() => { try { setSavedFilters(JSON.parse(window.localStorage.getItem("mapa-agencias-filtros") ?? "[]") as SavedFilter[]); } catch { setSavedFilters([]); } }, 0); return () => window.clearTimeout(timer); }, []);
  const cities = useMemo(() => [...new Set(agencies.map((a) => a.city))].sort(), [agencies]);
  const profiles = useMemo(() => [...new Set(agencies.map((a) => a.audienceProfile.split(" · ")[0]))].sort(), [agencies]);
  const filtered = useMemo(() => agencies.filter((a) => {
    const haystack = [a.tradeName, a.city, a.audienceProfile, ...a.programs].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase()) && (city === "Todas" || a.city === city) &&
      (profile === "Todos" || a.audienceProfile.startsWith(profile)) &&
      (potential === "Todos" || a.commercialPotential === potential) &&
      (status === "Todos" || (a.commercialStatus ?? "Não contatada") === status) &&
      (availability === "Todos" || (availability === "WhatsApp" ? Boolean(a.whatsapp || a.phone) : availability === "E-mail" ? Boolean(a.email) : availability === "Site" ? Boolean(a.website) : Boolean(a.instagram))) &&
      (Number(a.opportunityScore ?? 0) >= Number(minScore || 0));
  }).sort((a, b) => {
    if (sort === "city") return a.city.localeCompare(b.city, "pt-BR") || a.tradeName.localeCompare(b.tradeName, "pt-BR");
    if (sort === "lastContact") return (b.lastContactAt ?? "").localeCompare(a.lastContactAt ?? "");
    if (sort === "potential") return ({ A: 0, B: 1, C: 2 }[a.commercialPotential] ?? 3) - ({ A: 0, B: 1, C: 2 }[b.commercialPotential] ?? 3);
    return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
  }), [agencies, query, city, profile, potential, status, sort, availability, minScore]);

  function currentFilter(): SavedFilter { return { name: "", query, city, profile, potential, status, sort, availability, minScore }; }
  function saveFilter() {
    const name = window.prompt("Nome para este filtro:");
    if (!name?.trim()) return;
    const next = [...savedFilters.filter((item) => item.name !== name.trim()), { ...currentFilter(), name: name.trim() }];
    setSavedFilters(next); window.localStorage.setItem("mapa-agencias-filtros", JSON.stringify(next)); setMessage("Filtro salvo nesta sessão.");
  }
  function applyFilter(item: SavedFilter) { setQuery(item.query); setCity(item.city); setProfile(item.profile); setPotential(item.potential); setStatus(item.status); setSort(item.sort); setAvailability(item.availability); setMinScore(item.minScore); }
  async function shareFilter() {
    const params = new URLSearchParams(); if (query) params.set("q", query); if (city !== "Todas") params.set("city", city); if (potential !== "Todos") params.set("potential", potential); if (status !== "Todos") params.set("status", status); if (availability !== "Todos") params.set("availability", availability); if (minScore !== "0") params.set("score", minScore);
    const url = `${window.location.origin}/agencias?${params.toString()}`; await navigator.clipboard?.writeText(url); setMessage("Link do filtro copiado.");
  }
  const [message, setMessage] = useState("");

  function exportCsv() {
    trackEvent("busca_realizada", { count: filtered.length, directory: "exchange" });
    const rows = [["Agência", "Cidade", "Região", "Telefone", "WhatsApp", "Status", "Pontuação", "Potencial", "Responsável", "Último contato", "Próximo follow-up", "Valor estimado"], ...filtered.map((a) => [a.tradeName, a.city, a.region, a.phone ?? "", a.whatsapp ?? "", a.commercialStatus ?? "Não contatada", a.opportunityScore ?? 0, a.commercialPotential, a.assignedTo ?? "", a.lastContactAt ?? "", a.nextFollowUpAt ?? "", a.estimatedValue ?? ""])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" })); link.download = `agencias-intercambio-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <div className="directory-tools agency-tools">
        <label className="search-field"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar agência, cidade ou programa" aria-label="Buscar agências" /></label>
        <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filtrar por cidade"><option>Todas</option>{cities.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={profile} onChange={(e) => setProfile(e.target.value)} aria-label="Filtrar por perfil"><option>Todos</option>{profiles.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status comercial"><option>Todos</option>{commercialStatuses.map((item) => <option key={item}>{item}</option>)}</select>
        <div className="segmented" aria-label="Filtrar por potencial">{["Todos", "A", "B", "C"].map((item) => <button key={item} onClick={() => { setPotential(item); trackEvent("filtro_utilizado", { filter: "potential", value: item }); }} className={potential === item ? "active" : ""}>{item}</button>)}</div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar resultados"><option value="score">Ordenar: pontuação</option><option value="potential">Ordenar: potencial</option><option value="city">Ordenar: cidade</option><option value="lastContact">Ordenar: último contato</option></select><button type="button" className="directory-export" onClick={exportCsv}>Exportar CSV ↓</button>
        <select value={availability} onChange={(e) => setAvailability(e.target.value)} aria-label="Filtrar por contato"><option>Todos</option><option>WhatsApp</option><option>E-mail</option><option>Site</option><option>Instagram</option></select>
        <label className="score-filter"><span>Score mín.</span><input type="number" min="0" max="100" value={minScore} onChange={(e) => setMinScore(e.target.value)} /></label>
      </div>
      <div className="directory-saved-tools"><select value="" onChange={(event) => { const selected = savedFilters.find((item) => item.name === event.target.value); if (selected) applyFilter(selected); }} aria-label="Aplicar filtro salvo"><option value="">Filtros salvos</option>{savedFilters.map((item) => <option key={item.name}>{item.name}</option>)}</select><button type="button" onClick={saveFilter}>Salvar filtro</button><button type="button" onClick={shareFilter}>Compartilhar visualização</button>{message && <span>{message}</span>}</div>
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
