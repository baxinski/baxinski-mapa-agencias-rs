import type { Agency } from "@/lib/types";

const strategicCities = new Set([
  "Porto Alegre", "Caxias do Sul", "Gramado", "Canela", "Novo Hamburgo", "Santa Maria", "Passo Fundo",
  "Pelotas", "Bento Gonçalves", "Santa Cruz do Sul", "Canoas", "Erechim",
]);

export function calculateOpportunityScore(agency: Partial<Agency>) {
  let score = 0;
  if (agency.whatsapp || agency.phone) score += 10;
  if (agency.email) score += 5;
  if (agency.website) score += 10;
  if (agency.instagram || agency.linkedin) score += 5;
  if (agency.website || agency.instagram || agency.linkedin) score += 10;
  const reviews = agency.googleReviewCount ?? 0;
  score += Math.min(10, Math.round(reviews / 50));
  const rating = agency.googleRating ?? 0;
  score += Math.min(10, Math.max(0, Math.round((rating - 3) * 5)));
  if (agency.city && strategicCities.has(agency.city)) score += 10;
  if ((agency.programs?.length ?? 0) > 0 || (agency.destinations?.length ?? 0) > 0 || (agency.exchangeTypes?.length ?? 0) > 0) score += 15;
  if (!agency.lastContactAt && (agency.commercialStatus ?? "Não contatada") === "Não contatada") score += 5;
  if (agency.commercialPotential === "A") score += 10;
  return Math.max(0, Math.min(100, score));
}

export function scoreLabel(score: number) {
  if (score >= 80) return "Oportunidade prioritária";
  if (score >= 60) return "Alto potencial";
  if (score >= 30) return "Médio potencial";
  return "Baixo potencial";
}
