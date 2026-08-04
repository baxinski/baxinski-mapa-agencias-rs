import TourismDirectory from "@/app/components/TourismDirectory";

export default function TourismPage() {
  return <main className="page-shell tourism-page">
    <header className="page-heading"><div><span className="eyebrow">Cadastur · RS</span><h1>Agências de turismo do estado</h1></div><p>Listagem integral das agências de turismo do Rio Grande do Sul que estavam regulares e com certificado vigente na data da consulta.</p></header>
    <TourismDirectory />
  </main>;
}
