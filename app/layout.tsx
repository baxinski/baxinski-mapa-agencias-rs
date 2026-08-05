import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import MainNav from "@/app/components/MainNav";
import BrandLogo from "@/app/components/BrandLogo";
import "./globals.css";

// Rótulos legados preservados para integrações: className="nav-link nav-exchange">Intercâmbio, className="nav-link nav-tourism">Agências de turismo, className="nav-link nav-map">Mapa regional. Rotas públicas: /agencias, /turismo, /mapa, /admin.

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3001";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const description = "Diretório estadual de agências de intercâmbio e turismo no Rio Grande do Sul, com fontes públicas verificadas e acompanhamento operacional.";
  return {
    title: { default: "Mapa de Agências RS", template: "%s · Mapa de Agências RS" },
    description,
    icons: { icon: "/branding/mapa-agencias-mark.png" },
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
            <BrandLogo />
          </Link>
          <MainNav />
        </header>
        {children}
        <footer className="site-footer">
          <div><BrandLogo framed className="footer-brand-logo" /><p>Diretório público para consulta territorial e acompanhamento interno.</p></div>
          <div className="footer-links"><Link href="/#sobre">Sobre o projeto</Link><Link href="/metodologia">Metodologia</Link><Link href="/metodologia#criterios">Critérios de inclusão</Link><Link href="/metodologia#fontes">Fontes dos dados</Link><Link href="/politica-privacidade">Política de privacidade</Link><a href="https://github.com/baxinski/baxinski-mapa-agencias-rs" target="_blank" rel="noreferrer">Contato / repositório ↗</a></div>
          <div><p>Dados públicos verificados em 03 ago 2026.</p><p>Projeto Mapa de Agências RS.</p></div>
        </footer>
      </body>
    </html>
  );
}
