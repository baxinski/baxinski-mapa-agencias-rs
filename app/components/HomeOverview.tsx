"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HomeSnapshot } from "@/lib/home";

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPhone(value: string | null) {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim();
}

export default function HomeOverview({ initial }: { initial: HomeSnapshot }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/home", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("home");
        return await response.json() as HomeSnapshot;
      })
      .then(setData)
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  return <>
    <section className="home-hero">
      <div className="home-hero-copy">
        <span className="eyebrow">Diretório estadual · RS</span>
        <h1>Mapeamento de agências de intercâmbio e turismo no Rio Grande do Sul</h1>
        <p>Consulte agências por cidade, região e categoria, acompanhe informações relevantes e organize suas atividades em uma única plataforma.</p>
        <div className="home-hero-actions">
          <Link className="button primary" href="/mapa">Explorar mapa <span>↗</span></Link>
          <Link className="button text" href="/agencias">Ver agências <span>→</span></Link>
          <Link className="button text" href="/acompanhamento">Abrir acompanhamento <span>→</span></Link>
        </div>
        <div className="home-trust-row"><span>✓ Fontes públicas identificadas</span><span>✓ Dados por cidade e região</span><span>✓ Consulta sem anúncios</span></div>
      </div>

      <aside className="home-data-panel" aria-label="Resumo atual da base" aria-busy={loading}>
        <div className="home-panel-heading"><span>Resumo da base</span><span>{loading ? "Atualizando" : "Atualizada"}</span></div>
        <div className="home-total"><strong>{data.totalAgencies.toLocaleString("pt-BR")}</strong><span>agências cadastradas</span></div>
        <div className="home-stat-grid">
          <div><strong>{data.cityCount.toLocaleString("pt-BR")}</strong><span>cidades</span></div>
          <div><strong>{data.regionCount.toLocaleString("pt-BR")}</strong><span>regiões</span></div>
        </div>
        <div className="home-category-bars">
          {data.categories.map((item) => <div className="home-category" key={item.label}><div><span>{item.label}</span><strong>{item.count.toLocaleString("pt-BR")}</strong></div><i className={`tone-${item.tone}`}><b style={{ width: `${data.totalAgencies ? Math.max(3, item.count / data.totalAgencies * 100) : 0}%` }} /></i></div>)}
        </div>
        <div className="home-panel-foot"><span>Última atualização</span><strong>{formatDate(data.latestUpdated)}</strong></div>
      </aside>
    </section>

    <section className="home-quick-section" aria-labelledby="quick-access-title">
      <div className="section-intro"><div><span className="eyebrow">Acesso rápido</span><h2 id="quick-access-title">Consulte, compare e acompanhe.</h2></div><p>As principais tarefas do Mapa de Agências estão organizadas em três caminhos objetivos.</p></div>
      <div className="home-quick-grid">
        <article className="home-quick-card quick-map"><span className="quick-index">01</span><div className="quick-icon">⌖</div><h3>Explorar o mapa</h3><p>Encontre agências por localização, categoria, cidade e região.</p><Link href="/mapa" className="inline-link">Abrir mapa <span>↗</span></Link></article>
        <article className="home-quick-card quick-directory"><span className="quick-index">02</span><div className="quick-icon">▦</div><h3>Consultar agências</h3><p>Veja contatos, endereço, site, redes sociais e informações públicas.</p><Link href="/agencias" className="inline-link">Ver diretório <span>↗</span></Link></article>
        <article className="home-quick-card quick-follow"><span className="quick-index">03</span><div className="quick-icon">↗</div><h3>Organizar acompanhamento</h3><p>Registre contatos, visitas, retornos e observações em uma única ficha.</p><Link href="/acompanhamento" className="inline-link">Abrir acompanhamento <span>↗</span></Link></article>
      </div>
    </section>

    <section className="home-regions" id="regioes" aria-labelledby="regions-title">
      <div className="section-intro"><div><span className="eyebrow">Inteligência territorial</span><h2 id="regions-title">Visão por região</h2></div><p>Veja onde estão concentrados os registros e abra o mapa já filtrado pela região escolhida.</p></div>
      <div className="home-region-layout"><div className="home-region-visual"><div className="region-visual-label">Cobertura do estado</div><div className="region-visual-map"><span className="region-watermark">RS</span>{data.regions.slice(0, 8).map((region, index) => <span key={region.name} className={`region-dot region-dot-${index + 1}`} title={`${region.name}: ${region.count} agências`}><b>{region.count.toLocaleString("pt-BR")}</b></span>)}</div><Link href="/mapa#regioes" className="inline-link">Abrir mapa regional <span>↗</span></Link></div><div className="home-region-list">{data.regions.slice(0, 8).map((region, index) => <Link key={region.name} href={`/mapa?region=${encodeURIComponent(region.name)}#regioes`} className="home-region-row"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{region.name}</strong><small>{region.cities.slice(0, 3).join(" · ")}{region.cities.length > 3 ? " · …" : ""}</small></div><b>{region.count.toLocaleString("pt-BR")}</b></Link>)}{data.regions.length === 0 && <p className="empty-state compact">Nenhuma região informada.</p>}</div></div>
    </section>

    <section className="home-recent" aria-labelledby="recent-title">
      <div className="section-intro"><div><span className="eyebrow">Atualizações da base</span><h2 id="recent-title">Agências recentemente adicionadas</h2></div><Link href="/agencias" className="inline-link">Ver todas <span>↗</span></Link></div>
      <div className="home-recent-grid">{data.recent.map((record) => <article className="home-recent-card" key={record.id}><div className="recent-card-top"><span className={`record-kind record-kind-${record.kind}`}>{record.kind === "exchange" ? "Intercâmbio" : "Turismo"}</span><span>{formatDate(record.updatedAt)}</span></div><h3>{record.name}</h3><p className="recent-city">{record.city} · {record.region}</p>{(formatPhone(record.phone) || record.website) && <p className="recent-contact">{formatPhone(record.phone) || <a href={record.website ?? "#"} target="_blank" rel="noreferrer">Site oficial ↗</a>}</p>}<Link href={record.href} className="recent-link">Ver ficha <span>→</span></Link></article>)}{data.recent.length === 0 && <div className="empty-state"><strong>Nenhum registro recente.</strong><p>A base ainda não possui registros com data de atualização.</p></div>}</div>
    </section>

    <section className="home-quality" id="sobre" aria-labelledby="quality-title"><div className="quality-heading"><span className="eyebrow light">Qualidade dos dados</span><h2 id="quality-title">Informações organizadas e verificáveis.</h2><p>O Mapa de Agências é uma ferramenta de consulta e acompanhamento — não é marketplace, não vende planos e não distribui leads.</p><Link href="/metodologia" className="button light-button">Conhecer a metodologia <span>↗</span></Link></div><div className="quality-list"><div><span>01</span><strong>Fonte pública identificada</strong><p>Cada ficha mantém o caminho até a origem do dado.</p></div><div><span>02</span><strong>Data de atualização</strong><p>O momento da verificação fica visível na consulta.</p></div><div><span>03</span><strong>Separação territorial</strong><p>Cidade e região ajudam a entender a cobertura do estado.</p></div><div><span>04</span><strong>Histórico interno</strong><p>Contatos, visitas e observações ficam organizados para a equipe.</p></div></div></section>
  </>;
}

