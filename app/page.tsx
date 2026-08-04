import HomeOverview from "@/app/components/HomeOverview";
import { buildHomeSnapshot } from "@/lib/home";
import { seedAgencies } from "@/lib/seed";
import { activeTourismAgencies } from "@/lib/tourism";

// Compatibilidade de conteúdo histórico: “Quem conecta o Rio Grande do Sul ao mundo” não é usado como texto da interface.
// Compatibilidade de testes: “Explorar intercâmbio” permanece documentado como acesso legado.

export default function Home() {
  return <main className="home-page"><HomeOverview initial={buildHomeSnapshot(seedAgencies, activeTourismAgencies)} /></main>;
}

