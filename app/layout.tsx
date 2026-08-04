import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import SessionNav from "@/app/components/SessionNav";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3001";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const description = "Diretório estadual de agências de intercâmbio e turismo no Rio Grande do Sul, com fontes públicas verificadas e inteligência comercial.";
  return {
    title: { default: "Mapa de Agências RS", template: "%s · Mapa de Agências RS" },
    description,
    openGraph: { title: "Mapa de Agências RS", description, type: "website", locale: "pt_BR", images: [{ url: image, width: 1734, height: 907, alt: "Mapa de Agências RS" }] },
    twitter: { card: "summary_large_image", title: "Mapa de Agências RS", description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="Mapa de Agências RS — início">
            <span className="brand-mark">RS</span>
            <span><strong>Mapa de Agências</strong><small>Rio Grande do Sul</small></span>
          </Link>
          <nav aria-label="Navegação principal">
            <Link href="/dashboard" className="nav-link nav-dashboard">Dashboard</Link>
            <Link href="/agencias" className="nav-link nav-exchange">Intercâmbio</Link>
            <Link href="/turismo" className="nav-link nav-tourism">Agências de turismo</Link>
            <Link href="/mapa" className="nav-link nav-map">Mapa regional</Link>
            <Link href="/encontrar-agencia" className="nav-link nav-lead">Encontrar agência</Link>
            <Link href="/importar" className="nav-link nav-import">Importar base</Link>
            <Link href="/planos" className="nav-link nav-plans">Planos</Link>
            <SessionNav />
            <Link href="/admin" className="nav-admin">Painel administrativo</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <div><span className="eyebrow">Mapa de Agências RS</span><p>Inteligência comercial com origem e contexto.</p></div>
          <div><p>Bases públicas verificadas em 03 ago 2026.</p><p>Potencial A/B/C é uma avaliação editorial interna.</p></div>
        </footer>
      </body>
    </html>
  );
}
