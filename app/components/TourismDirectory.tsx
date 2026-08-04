"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TourismAgency } from "@/lib/types";

const PAGE_SIZE = 48;

type TourismResponse = {
  records: TourismAgency[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  source: {
    label: string;
    url: string;
    verifiedAt: string;
    activeRule: string;
  };
  cities: string[];
};

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatPhone(value: string | null) {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

function formatCep(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? digits.replace(/^(\d{5})(\d{3})$/, "$1-$2") : value;
}

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function externalUrl(value: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized || /^(sem site|não tenho site|nao tenho site|não informado|nao informado)$/i.test(normalized)) return null;
  if (normalized.startsWith("@")) return `https://www.instagram.com/${normalized.slice(1)}`;
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}

function displayName(agency: TourismAgency) {
  return agency.tradeName === "*" ? "Nome não divulgado" : agency.tradeName;
}

export default function TourismDirectory() {
  const [payload, setPayload] = useState<TourismResponse | null>(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Todas");
  const [completeness, setCompleteness] = useState("Todos");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (query.trim()) params.set("q", query.trim());
    if (city !== "Todas") params.set("city", city);
    if (completeness === "Com site") params.set("website", "1");
    if (completeness === "Com telefone") params.set("phone", "1");
    // The request state is intentionally updated before the async load starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/turismo?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar a base de turismo");
        return await response.json() as TourismResponse;
      })
      .then(setPayload)
      .finally(() => setLoading(false));
  }, [query, city, completeness, page]);

  const records = payload?.records ?? [];
  const cities = payload?.cities ?? [];
  const currentPage = payload?.page ?? page;
  const totalPages = Math.max(1, Math.ceil((payload?.total ?? 0) / PAGE_SIZE));
  const firstVisible = payload?.total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastVisible = payload?.total ? Math.min(currentPage * PAGE_SIZE, payload.total) : 0;

  return (
    <>
      <div className="tourism-source-note">
        <div><span className="status-badge">Somente ativas</span><strong>{loading ? "Consultando Cadastur…" : `${records.length.toLocaleString("pt-BR")} agências regulares`}</strong></div>
        <p>Filtro aplicado: situação <b>Regular</b> e certificado válido em <b>03 ago 2026</b>. A consulta foi feita na base pública do Cadastur.</p>
      </div>

      <div className="directory-tools tourism-tools">
        <label className="search-field"><span>⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar nome, CNPJ ou cidade" aria-label="Buscar agências de turismo" /></label>
        <select value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }} aria-label="Filtrar por cidade"><option>Todas</option>{cities.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={completeness} onChange={(event) => { setCompleteness(event.target.value); setPage(1); }} aria-label="Filtrar por informação de contato"><option>Todos</option><option>Com site</option><option>Com telefone</option></select>
      </div>

      <div className="results-meta"><span>{loading ? "Carregando base…" : `${firstVisible}–${lastVisible} de ${(payload?.total ?? 0).toLocaleString("pt-BR")}`}</span><span>243 municípios · fonte pública em cada registro</span></div>

      {loading ? <div className="loading-panel"><strong>Carregando a base oficial…</strong><p>Estamos preparando os filtros por cidade e contato.</p></div> : (
        <>
          <div className="tourism-grid">
            {records.map((agency) => {
              const cep = formatCep(agency.cep);
              const websiteUrl = externalUrl(agency.website);
              return (
                <article className="tourism-card" key={agency.id}>
                  <div className="tourism-card-head"><span className="status-badge">Regular</span><span>Cadastur · {formatCnpj(agency.cadasturNumber)}</span></div>
                  <h2><Link href={`/turismo/${agency.id}`}>{displayName(agency)}</Link></h2>
                  {agency.legalName && agency.legalName !== agency.tradeName && <p className="tourism-legal">{agency.legalName}</p>}
                  <p className="location">{agency.city} <span>·</span> RS</p>
                  <dl className="tourism-fields">
                    <div><dt>Endereço</dt><dd>{agency.address ?? "Não informado"}{agency.neighborhood ? ` · ${agency.neighborhood}` : ""}{cep ? ` · CEP ${cep}` : ""}</dd></div>
                    <div><dt>Telefone</dt><dd>{formatPhone(agency.phone)}</dd></div>
                    <div><dt>Vigência</dt><dd>até {formatDate(agency.expiresAt)}</dd></div>
                  </dl>
                  <div className="tourism-card-foot">
                    <Link className="tourism-detail-link" href={`/turismo/${agency.id}`}>Abrir ficha completa →</Link>
                    <span>{websiteUrl ? <a href={websiteUrl} target="_blank" rel="noreferrer">Abrir contato ↗</a> : "Contato digital não informado"}</span>
                    <a href={agency.sourceUrl} target="_blank" rel="noreferrer">Fonte Cadastur ↗</a>
                  </div>
                </article>
              );
            })}
          </div>
          {records.length === 0 && <div className="empty-state"><strong>Nenhuma agência encontrada.</strong><p>Experimente retirar um filtro ou buscar outro município.</p></div>}
          {totalPages > 1 && <nav className="pagination" aria-label="Paginação da lista de agências">
            <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>← Anterior</button>
            <span>Página {currentPage} de {totalPages}</span>
            <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>Próxima →</button>
          </nav>}
        </>
      )}
    </>
  );
}
