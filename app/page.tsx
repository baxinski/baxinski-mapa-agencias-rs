import Link from "next/link";
import { seedAgencies } from "@/lib/seed";
import { activeTourismAgencies } from "@/lib/tourism";

const cityCount = new Set(seedAgencies.map((agency) => agency.city)).size;
const tourismCityCount = new Set(activeTourismAgencies.map((agency) => agency.city)).size;

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Diretório comercial · RS</span>
          <h1>Quem conecta o Rio Grande do Sul ao mundo.</h1>
          <p className="hero-lead">Uma base viva para encontrar, qualificar e acompanhar agências de intercâmbio em todo o estado — com a fonte de cada dado à vista.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/agencias">Explorar intercâmbio <span>↗</span></Link>
            <Link className="button text" href="/turismo">Agências de turismo <span>→</span></Link>
            <Link className="button text" href="/mapa">Ver regiões <span>→</span></Link>
          </div>
        </div>
        <div className="hero-panel" aria-label="Resumo da base">
          <div className="panel-top"><span>Base inicial</span><span>Atualizada</span></div>
          <div className="big-number">{seedAgencies.length.toString().padStart(2, "0")}</div>
          <p>fichas com fonte pública rastreável</p>
          <div className="metric-row"><strong>{cityCount}</strong><span>cidades</span><strong>6</strong><span>regiões</span></div>
          <div className="route-line"><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <section className="value-strip">
        <article><span>01</span><h2>Descobrir</h2><p>Busca por nome, cidade, programa e perfil de público.</p></article>
        <article><span>02</span><h2>Priorizar</h2><p>Potencial comercial A/B/C com critérios visíveis e editáveis.</p></article>
        <article><span>03</span><h2>Relacionar</h2><p>Histórico de contatos e próximos passos na mesma ficha.</p></article>
      </section>

      <section className="tourism-callout">
        <div>
          <span className="eyebrow">Nova frente · Cadastur</span>
          <h2>O mesmo mapa agora acompanha o turismo do estado.</h2>
          <p>Uma listagem pública, pesquisável e atualizada com as agências que estavam regulares no Cadastur na data da consulta.</p>
        </div>
        <div className="tourism-callout-stat"><strong>{activeTourismAgencies.length.toLocaleString("pt-BR")}</strong><span>agências regulares em {tourismCityCount} municípios</span><Link href="/turismo" className="inline-link">Abrir diretório de turismo <span>→</span></Link></div>
      </section>

      <section className="feature-split">
        <div>
          <span className="eyebrow">Cobertura responsável</span>
          <h2>Uma ficha só é útil quando se sabe de onde veio.</h2>
        </div>
        <div className="feature-copy">
          <p>Endereços, telefones, programas e associação BELTA vêm acompanhados da fonte e da data de verificação. Campos sem confirmação pública aparecem como pendentes — nunca preenchidos por inferência.</p>
          <Link href="/agencias" className="inline-link">Consultar as fichas verificadas <span>→</span></Link>
        </div>
      </section>

      <section className="cta-band">
        <div><span className="eyebrow light">Operação comercial</span><h2>Do mapa à próxima conversa.</h2></div>
        <Link href="/admin" className="button light-button">Abrir painel <span>↗</span></Link>
      </section>
    </main>
  );
}
