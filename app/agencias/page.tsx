import AgencyDirectory from "@/app/components/AgencyDirectory";

export default function AgenciesPage() {
  return <main className="page-shell">
    <header className="page-heading"><div><span className="eyebrow">Base verificada</span><h1>Agências de intercâmbio</h1></div><p>Pesquise, compare perfis e abra a ficha completa para consultar contatos, programas e fontes.</p></header>
    <AgencyDirectory />
  </main>;
}
