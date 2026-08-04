"use client";

import { useEffect, useMemo, useState } from "react";
import type { TourismAgency } from "@/lib/types";

const PAGE_SIZE = 48;

type TourismResponse = {
  records: TourismAgency[];
  total: number;
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

function externalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
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
    fetch("/api/turismo")
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar a base de turismo");
        return await response.json() as TourismResponse;
      })
      .then(setPayload)
      .finally(() => setLoading(false));
  }, []);

  const records = payload?.records ?? [];
  const cities = payload?.cities ?? [];
  const filtered = useMemo(() => records.filter((agency) => {
    const haystack = [agency.tradeName, agency.legalName ?? "", agency.city, agency.cadasturNumber, agency.address ?? ""].join(" ").toLocaleLowerCase("pt-BR");
    const matchesQuery = haystack.includes(query.trim().toLocaleLowerCase("pt-BR"));
    const matchesCity = city === "Todas" || agency.city === city;
    const matchesCompleteness = completeness === "Todos" ||
      (completeness === "Com site" && Boolean(agency.website)) ||
      (completeness === "Com telefone" && Boolean(agency.phone));
    return matchesQuery && matchesCity && matchesCompleteness;
  }), [records, query, city, completeness]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstVisible = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastVisible = Math.min(currentPage * PAGE_SIZE, filtered.length);

  useEffect(() => { const timer = window.setTimeout(() => setPage(1), 0); return () => window.clearTimeout(timer); }, [query, city, completeness]);

  return (
    <>
      <div className="tourism-source-note">
        <div><span className="status-badge">Somente ativas</span><strong>{loading ? "Consultando Cadastur…" : `${records.length.toLocaleString("pt-BR")} agências regulares`}</strong></div>
        <p>Filtro aplicado: situação <b>Regular</b> e certificado válido em <b>03 ago 2026</b>. A consulta foi feita na base pública do Cadastur.</p>
      </div>

      <div className="directory-tools tourism-tools">
        <label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, CNPJ ou cidade" aria-label="Buscar agências de turismo" /></label>
        <select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filtrar por cidade"><option>Todas</option>{cities.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={completeness} onChange={(event) => setCompleteness(event.target.value)} aria-label="Filtrar por informação de contato"><option>Todos</option><option>Com site</option><option>Com telefone</option></select>
      </div>

      <div className="results-meta"><span>{loading ? "Carregando base…" : `${firstVisible}–${lastVisible} de ${filtered.length.toLocaleString("pt-BR")}`}</span><span>243 municípios · fonte pública em cada registro</span></div>

      {loading ? <div className="loading-panel"><strong>Carregando a base oficial…</strong><p>Estamos preparando os filtros por cidade e contato.</p></div> : (
        <>
          <div className="tourism-grid">
            {visible.map((agency) => {
              const cep = formatCep(agency.cep);
              return (
                <article className="tourism-card" key={agency.id}>
                  <div className="tourism-card-head"><span className="status-badge">Regular</span><span>Cadastur · {formatCnpj(agency.cadasturNumber)}</span></div>
                  <h2>{displayName(agency)}</h2>
                  {agency.legalName && agency.legalName !== agency.tradeName && <p className="tourism-legal">{agency.legalName}</p>}
                  <p className="location">{agency.city} <span>·</span> RS</p>
                  <dl className="tourism-fields">
                    <div><dt>Endereço</dt><dd>{agency.address ?? "Não informado"}{agency.neighborhood ? ` · ${agency.neighborhood}` : ""}{cep ? ` · CEP ${cep}` : ""}</dd></div>
                    <div><dt>Telefone</dt><dd>{formatPhone(agency.phone)}</dd></div>
                    <div><dt>Vigência</dt><dd>até {formatDate(agency.expiresAt)}</dd></div>
                  </dl>
                  <div className="tourism-card-foot">
                    <span>{agency.website ? <a href={externalUrl(agency.website)} target="_blank" rel="noreferrer">Abrir contato ↗</a> : "Contato digital não informado"}</span>
                    <a href={agency.sourceUrl} target="_blank" rel="noreferrer">Fonte Cadastur ↗</a>
                  </div>
                </article>
              );
            })}
          </div>
          {visible.length === 0 && <div className="empty-state"><strong>Nenhuma agência encontrada.</strong><p>Experimente retirar um filtro ou buscar outro município.</p></div>}
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
