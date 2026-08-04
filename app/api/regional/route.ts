import { listAgencies } from "@/db";
import { regionForCity, regionalOrder } from "@/lib/regional";
import { activeTourismAgencies } from "@/lib/tourism";
import type { Agency, RegionalGroup, RegionalRecord, RegionalResponse, TourismAgency } from "@/lib/types";
import { getAuthenticatedUserWithRole } from "@/app/auth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 36;
const MAX_LIMIT = 72;

function displayTourismName(agency: TourismAgency) {
  return agency.tradeName === "*" ? "Nome não divulgado" : agency.tradeName;
}

function toExchangeRecord(agency: Agency, includeCommercial: boolean): RegionalRecord & { searchText: string } {
  return {
    id: `exchange-${agency.id}`,
    kind: "exchange",
    name: agency.tradeName,
    legalName: agency.legalName,
    city: agency.city,
    region: agency.region,
    summary: agency.audienceProfile,
    address: agency.address,
    phone: agency.phone,
    email: agency.email,
    website: agency.website,
    href: `/agencias/${agency.slug}`,
    sourceUrl: agency.sourceUrl,
    commercialStatus: includeCommercial ? agency.commercialStatus ?? "Não contatada" : undefined,
    searchText: [agency.tradeName, agency.legalName ?? "", agency.city, agency.region, agency.address ?? "", agency.phone ?? "", agency.email ?? "", agency.website ?? "", ...agency.programs].join(" "),
  };
}

function toTourismRecord(agency: TourismAgency): RegionalRecord & { searchText: string } {
  return {
    id: `tourism-${agency.id}`,
    kind: "tourism",
    name: displayTourismName(agency),
    legalName: agency.legalName,
    city: agency.city,
    region: regionForCity(agency.city),
    summary: `Cadastur ${agency.cadasturNumber} · ${agency.status}`,
    address: [agency.address, agency.neighborhood, agency.cep ? `CEP ${agency.cep}` : ""].filter(Boolean).join(" · ") || null,
    phone: agency.phone,
    email: null,
    website: agency.website,
    href: `/turismo/${agency.id}`,
    sourceUrl: agency.sourceUrl,
    searchText: [agency.tradeName, agency.legalName ?? "", agency.cadasturNumber, agency.city, agency.address ?? "", agency.neighborhood ?? "", agency.cep ?? "", agency.phone ?? "", agency.website ?? ""].join(" "),
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().toLocaleLowerCase("pt-BR");
  const type = params.get("type") ?? "todos";
  const city = (params.get("city") ?? "").trim();
  const region = (params.get("region") ?? "").trim();
  const requestedLimit = Number(params.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT) : DEFAULT_LIMIT;
  const agencies = await listAgencies();
  const user = await getAuthenticatedUserWithRole();
  const allRecords = [...agencies.map((agency) => toExchangeRecord(agency, Boolean(user))), ...activeTourismAgencies.map(toTourismRecord)];
  const filtered = allRecords.filter((record) => {
    const matchesQuery = !query || record.searchText.toLocaleLowerCase("pt-BR").includes(query);
    const matchesType = type === "intercambio" ? record.kind === "exchange" : type === "turismo" ? record.kind === "tourism" : true;
    return matchesQuery && matchesType && (!city || record.city === city) && (!region || record.region === region);
  });

  const grouped = filtered.reduce<Record<string, { count: number; cities: Set<string>; statuses: Record<string, number> }>>((acc, record) => {
    const group = acc[record.region] ?? { count: 0, cities: new Set<string>(), statuses: {} };
    group.count += 1;
    group.cities.add(record.city);
    if (record.kind === "exchange" && record.commercialStatus) group.statuses[record.commercialStatus] = (group.statuses[record.commercialStatus] ?? 0) + 1;
    acc[record.region] = group;
    return acc;
  }, {});
  const regions = Object.entries(grouped).map(([regionName, group]) => ({ region: regionName, count: group.count, cities: [...group.cities].sort((a, b) => a.localeCompare(b, "pt-BR")), dominantStatus: Object.entries(group.statuses).sort((a, b) => b[1] - a[1])[0]?.[0] as RegionalGroup["dominantStatus"] ?? null })).sort((a, b) => {
    const byCount = b.count - a.count;
    return byCount || regionalOrder.indexOf(a.region) - regionalOrder.indexOf(b.region);
  });
  const response: RegionalResponse = {
    records: filtered.slice(0, limit).map((record) => { const { searchText, ...publicRecord } = record; void searchText; return publicRecord; }),
    total: filtered.length,
    exchangeCount: filtered.filter((record) => record.kind === "exchange").length,
    tourismCount: filtered.filter((record) => record.kind === "tourism").length,
    hasMore: filtered.length > limit,
    regions,
    cities: [...new Set(allRecords.map((record) => record.city))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    availableRegions: regionalOrder.filter((item) => allRecords.some((record) => record.region === item)),
  };

  return Response.json(response, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" } });
}
