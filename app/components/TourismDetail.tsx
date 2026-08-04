import Link from "next/link";
import type { TourismAgency } from "@/lib/types";
import { regionForCity } from "@/lib/regional";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="detail-field"><dt>{label}</dt><dd>{value || <span className="pending">Não informado</span>}</dd></div>;
}

function digits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const valueDigits = digits(value);
  if (valueDigits.length !== 14) return value;
  return valueDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatPhone(value: string | null) {
  if (!value) return null;
  const valueDigits = digits(value);
  if (valueDigits.length === 11) return `(${valueDigits.slice(0, 2)}) ${valueDigits.slice(2, 7)}-${valueDigits.slice(7)}`;
  if (valueDigits.length === 10) return `(${valueDigits.slice(0, 2)}) ${valueDigits.slice(2, 6)}-${valueDigits.slice(6)}`;
  return value;
}

function formatCep(value: string | null) {
  if (!value) return null;
  const valueDigits = digits(value);
  return valueDigits.length === 8 ? valueDigits.replace(/^(\d{5})(\d{3})$/, "$1-$2") : value;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
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

export default function TourismDetail({ agency }: { agency: TourismAgency }) {
  const phone = formatPhone(agency.phone);
  const phoneNumber = digits(agency.phone);
  const websiteUrl = externalUrl(agency.website);
  const isInstagram = Boolean(agency.website?.trim().startsWith("@") || agency.website?.toLowerCase().includes("instagram.com"));
  const addressParts = [agency.address, agency.neighborhood, agency.city, agency.state, agency.cep ? `CEP ${formatCep(agency.cep)}` : ""].filter(Boolean);
  const mapsUrl = addressParts.length ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParts.join(", "))}` : null;
  const verifiedAt = formatDate(agency.verifiedAt);
  const issuedAt = formatDate(agency.issuedAt);
  const expiresAt = formatDate(agency.expiresAt);

  return <>
    <div className="detail-hero">
      <Link href="/turismo" className="back-link">← Diretório de agências de turismo</Link>
      <div className="detail-title"><div><span className="eyebrow">{agency.city} · {regionForCity(agency.city)}</span><h1>{displayName(agency)}</h1><p>{agency.activity} · Cadastur {formatCnpj(agency.cadasturNumber)}</p></div><div className="detail-title-badges"><span className="status-badge">{agency.status}</span><span className="verified-dot">Cadastro ativo</span></div></div>
    </div>
    <div className="detail-layout">
      <div className="detail-main">
        <section className="detail-section"><div className="section-number">01</div><div><h2>Dados da agência</h2><dl className="detail-grid"><Field label="Razão social" value={agency.legalName} /><Field label="Nome fantasia" value={displayName(agency)} /><Field label="Estado" value={agency.state} /><Field label="Cidade" value={agency.city} /><Field label="Região" value={regionForCity(agency.city)} /><Field label="Bairro" value={agency.neighborhood} /><Field label="Endereço" value={agency.address} /><Field label="CEP" value={formatCep(agency.cep)} /><Field label="Telefone" value={phone} /><Field label={isInstagram ? "Instagram / perfil" : "Site"} value={agency.website} /></dl></div></section>
        <section className="detail-section"><div className="section-number">02</div><div><h2>Cadastro e validade</h2><dl className="detail-grid"><Field label="Número Cadastur" value={formatCnpj(agency.cadasturNumber)} /><Field label="Código da atividade" value={agency.activityCode} /><Field label="Atividade cadastrada" value={agency.activity} /><Field label="Situação" value={agency.status} /><Field label="Certificado emitido em" value={issuedAt} /><Field label="Certificado válido até" value={expiresAt} /></dl></div></section>
        <section className="detail-section"><div className="section-number">03</div><div><h2>Dados públicos complementares</h2><dl className="detail-grid compact"><Field label="E-mail" value={null} /><Field label="WhatsApp" value={null} /><Field label="Diretores ou proprietários" value={null} /><Field label="Responsável pelo intercâmbio" value={null} /><Field label="Número de unidades" value={null} /><Field label="Histórico de contatos" value={null} /></dl><p className="source-note">A consulta Cadastur publica os campos acima para este registro. Informações que não aparecem na fonte oficial ficam marcadas como “Não informado”, sem estimativas.</p></div></section>
      </div>
      <aside className="source-card"><span className="verified-stamp">✓ Dado rastreável</span><h2>Ações rápidas</h2><div className="quick-actions">{phoneNumber && <a href={`tel:${phoneNumber}`}>Ligar · {phone}</a>}{websiteUrl && <a href={websiteUrl} target="_blank" rel="noreferrer">{isInstagram ? "Abrir Instagram ↗" : "Abrir site ↗"}</a>}{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Ver localização ↗</a>}</div><h2>Fonte pública</h2><p>{agency.sourceLabel}</p><a href={agency.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a><dl><Field label="Situação" value={agency.status} /><Field label="Certificado válido até" value={expiresAt} /><Field label="Verificado em" value={verifiedAt} /></dl><Link href="/turismo" className="button primary full">Voltar ao diretório</Link></aside>
    </div>
  </>;
}
