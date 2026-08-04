"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { regionalOrder } from "@/lib/regional";
import type { RegionalGroup, RegionalRecord, RegionalResponse } from "@/lib/types";

const positions: Record<string, { x: number; y: number }> = {
  Metropolitana: { x: 57, y: 76 }, Serra: { x: 67, y: 27 }, Centro: { x: 47, y: 51 },
  "Vale dos Sinos": { x: 63, y: 63 }, Vales: { x: 51, y: 40 }, "Litoral Norte": { x: 73, y: 41 },
  Norte: { x: 52, y: 16 }, Noroeste: { x: 30, y: 28 }, "Fronteira Oeste": { x: 25, y: 60 },
  Campanha: { x: 35, y: 80 }, Sul: { x: 49, y: 88 }, Interior: { x: 40, y: 57 },
};

type DirectoryFilter = "Todos" | "Intercâmbio" | "Turismo";

function statusClass(status: string) { return status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"); }

const emptyResponse: RegionalResponse = {
  records: [], total: 0, exchangeCount: 0, tourismCount: 0, hasMore: false, regions: [], cities: [], availableRegions: [],
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

function phoneHref(value: string) {
  return `tel:${value.replace(/\D/g, "")}`;
}

function contactLabel(record: RegionalRecord) {
  if (record.email && record.website) return <><a href={`mailto:${record.email}`}>{record.email}</a><br /><a href={record.website} target="_blank" rel="noreferrer">Abrir site ↗</a></>;
  if (record.email) return <a href={`mailto:${record.email}`}>{record.email}</a>;
  if (record.website) return <a href={record.website} target="_blank" rel="noreferrer">Abrir site ↗</a>;
  return "Não informado";
}

export default function RegionalView() {
  const [payload, setPayload] = useState<RegionalResponse>(emptyResponse);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DirectoryFilter>("Todos");
  const [city, setCity] = useState("Todas");
  const [region, setRegion] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "36" });
    const normalizedQuery = query.trim();
    if (normalizedQuery) params.set("q", normalizedQuery);
    if (kind !== "Todos") params.set("type", kind === "Intercâmbio" ? "intercambio" : "turismo");
    if (city !== "Todas") params.set("city", city);
    if (region !== "Todas") params.set("region", region);
    const delay = normalizedQuery ? 220 : 0;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(`/api/regional?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("regional");
          return await response.json() as RegionalResponse;
        })
        .then(setPayload)
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setError("Não foi possível carregar a visão regional agora.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, kind, city, region]);

  const regions: RegionalGroup[] = payload.regions;

  function resetFilters() {
    setQuery("");
    setKind("Todos");
    setCity("Todas");
    setRegion("Todas");
  }

  return <>
    <div className="map-layout">
      <section className="region-map" aria-label="Mapa esquemático das regiões atendidas">
        <div className="map-caption"><span>Visão esquemática</span><small>Intercâmbio + turismo · não representa limites exatos</small></div>
        <div className="map-shape" />
        {regions.map((group) => {
          const pos = positions[group.region] ?? { x: 50, y: 52 };
          const edgeClass = pos.x > 68 ? " map-node-left" : pos.x < 30 ? " map-node-right" : "";
          return <button type="button" className={`map-node${edgeClass}${region === group.region ? " active" : ""}${group.dominantStatus ? ` map-node-status-${statusClass(group.dominantStatus)}` : " map-node-status-tourism"}`} key={group.region} style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onClick={() => setRegion(group.region)} aria-label={`Filtrar região ${group.region}`}>
            <span>{group.count.toLocaleString("pt-BR")}</span><strong>{group.region}</strong>
          </button>;
        })}
        <div className="map-watermark">RS</div>
        <div className="map-status-legend" aria-label="Legenda de status comercial"><span><i className="legend-dot legend-neutral" />Não contatada</span><span><i className="legend-dot legend-open" />Em andamento</span><span><i className="legend-dot legend-client" />Cliente</span></div>
      </section>
      <aside className="region-list">
        <span className="eyebrow">Cobertura filtrada</span><h2>Por região</h2>
        {regions.map((group, index) => <button type="button" className={`region-row${region === group.region ? " active" : ""}`} key={group.region} onClick={() => setRegion(group.region)} aria-pressed={region === group.region}>
          <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{group.region}</strong><small>{group.cities.slice(0, 4).join(" · ")}{group.cities.length > 4 ? " · …" : ""}</small></div><b>{group.count.toLocaleString("pt-BR")}</b>
        </button>)}
        {regions.length === 0 && <p className="regional-empty">Nenhuma região corresponde aos filtros.</p>}
        <button type="button" className="inline-link inline-link-button" onClick={resetFilters}>Limpar filtros <span>↺</span></button>
      </aside>
    </div>

    <section className="regional-search" aria-label="Pesquisar nas duas bases" aria-busy={loading}>
      <div className="regional-search-head"><div><span className="eyebrow">Pesquisa unificada</span><h2>Encontre intercâmbio e turismo no mesmo lugar.</h2></div><p>Use nome, cidade, CNPJ, região ou perfil. Cada resultado mantém endereço, telefone e contato digital quando publicados.</p></div>
      <div className="directory-tools regional-tools">
        <label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, cidade, CNPJ ou endereço" aria-label="Buscar nas bases de intercâmbio e turismo" /></label>
        <select value={kind} onChange={(event) => setKind(event.target.value as DirectoryFilter)} aria-label="Filtrar por base"><option>Todos</option><option>Intercâmbio</option><option>Turismo</option></select>
        <select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="Filtrar por região"><option>Todas</option>{(payload.availableRegions.length ? payload.availableRegions : regionalOrder).map((item) => <option key={item}>{item}</option>)}</select>
        <select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filtrar por cidade"><option>Todas</option>{payload.cities.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      <div className="regional-summary"><span>{loading ? "Atualizando pesquisa…" : `${payload.total.toLocaleString("pt-BR")} resultados`}</span><span><b>{payload.exchangeCount.toLocaleString("pt-BR")}</b> intercâmbio · <b>{payload.tourismCount.toLocaleString("pt-BR")}</b> turismo</span>{error && <span className="regional-error">{error}</span>}</div>
      <div className="regional-results">
        {payload.records.map((record) => <article className="regional-result" key={record.id}>
          <div className="regional-result-head"><span className={`regional-kind regional-kind-${record.kind}`}>{record.kind === "exchange" ? "Intercâmbio" : "Turismo"}</span>{record.commercialStatus && <span className={`crm-status crm-status-${statusClass(record.commercialStatus)}`}>{record.commercialStatus}</span>}<span>{record.city} · {record.region}</span></div>
          <h3>{record.name}</h3>
          {record.legalName && record.legalName !== record.name && <p className="regional-legal">{record.legalName}</p>}
          <p className="regional-record-summary">{record.summary}</p>
          <dl className="regional-contact-grid">
            <div className="regional-contact-address"><dt>Endereço</dt><dd>{record.address || "Não informado"}</dd></div>
            <div><dt>Telefone</dt><dd>{record.phone ? <a href={phoneHref(record.phone)}>{formatPhone(record.phone)}</a> : "Não informado"}</dd></div>
            <div><dt>Contato digital</dt><dd>{contactLabel(record)}</dd></div>
          </dl>
          <div className="regional-result-foot"><Link href={record.href}>{record.kind === "exchange" ? "Abrir ficha →" : "Abrir diretório →"}</Link>{record.sourceUrl && <a href={record.sourceUrl} target="_blank" rel="noreferrer">Fonte ↗</a>}</div>
        </article>)}
      </div>
      {!loading && payload.records.length === 0 && <div className="empty-state"><strong>Nenhum resultado encontrado.</strong><p>Experimente remover um filtro ou buscar outro termo.</p></div>}
      {payload.hasMore && <p className="regional-limit">Mostrando os primeiros {payload.records.length} resultados. Refine a busca para localizar uma ficha específica.</p>}
    </section>
  </>;
}
