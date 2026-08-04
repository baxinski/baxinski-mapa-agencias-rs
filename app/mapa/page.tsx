import RegionalView from "@/app/components/RegionalView";

export default function MapPage() {
  return <main className="page-shell">
    <header className="page-heading"><div><span className="eyebrow">Rio Grande do Sul · base unificada</span><h1>Visão regional</h1></div><p>Compare agências de intercâmbio e turismo, filtre por região ou cidade e encontre a próxima oportunidade de prospecção.</p></header>
    <RegionalView />
    <section className="map-insight"><span>Leitura comercial</span><p>A visão combina as fichas de intercâmbio com os registros de turismo regulares no Cadastur. A regionalização é esquemática e serve para comparar cobertura, concentração e cidades atendidas; cada resultado mantém seu caminho para a ficha ou para a fonte pública.</p></section>
  </main>;
}
