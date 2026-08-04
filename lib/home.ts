import { regionForCity, regionalOrder } from "./regional";
import type { Agency, TourismAgency } from "./types";

export type HomeRecord = {
  id: string;
  kind: "exchange" | "tourism";
  name: string;
  city: string;
  region: string;
  phone: string | null;
  website: string | null;
  updatedAt: string | null;
  href: string;
  sourceLabel: string | null;
};

export type HomeRegion = { name: string; count: number; cities: string[] };

export type HomeSnapshot = {
  totalAgencies: number;
  exchangeAgencies: number;
  tourismAgencies: number;
  cityCount: number;
  regionCount: number;
  latestUpdated: string | null;
  categories: Array<{ label: string; count: number; tone: "exchange" | "tourism" }>;
  regions: HomeRegion[];
  recent: HomeRecord[];
};

function displayTourismName(item: TourismAgency) {
  return item.tradeName === "*" ? "Nome não divulgado" : item.tradeName;
}

function toExchangeRecord(item: Agency): HomeRecord {
  return {
    id: `exchange-${item.id}`,
    kind: "exchange",
    name: item.tradeName,
    city: item.city,
    region: item.region,
    phone: item.phone,
    website: item.website,
    updatedAt: item.updatedAt || item.verifiedAt,
    href: `/agencias/${item.slug}`,
    sourceLabel: item.sourceLabel,
  };
}

function toTourismRecord(item: TourismAgency): HomeRecord {
  return {
    id: `tourism-${item.id}`,
    kind: "tourism",
    name: displayTourismName(item),
    city: item.city,
    region: regionForCity(item.city),
    phone: item.phone,
    website: item.website,
    updatedAt: item.verifiedAt,
    href: `/turismo/${item.id}`,
    sourceLabel: item.sourceLabel,
  };
}

export function buildHomeSnapshot(agencies: Agency[], tourism: TourismAgency[]): HomeSnapshot {
  const exchangeRecords = agencies.map(toExchangeRecord);
  const tourismRecords = tourism.map(toTourismRecord);
  const records = [...exchangeRecords, ...tourismRecords];
  const citySet = new Set(records.map((record) => record.city));
  const grouped = new Map<string, { count: number; cities: Set<string> }>();

  for (const record of records) {
    const current = grouped.get(record.region) ?? { count: 0, cities: new Set<string>() };
    current.count += 1;
    current.cities.add(record.city);
    grouped.set(record.region, current);
  }

  const regions = [...grouped.entries()]
    .map(([name, value]) => ({ name, count: value.count, cities: [...value.cities].sort((a, b) => a.localeCompare(b, "pt-BR")) }))
    .sort((a, b) => b.count - a.count || regionalOrder.indexOf(a.name) - regionalOrder.indexOf(b.name));
  const recent = [...records]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 6);
  const dates = records.map((record) => record.updatedAt).filter((value): value is string => Boolean(value)).sort();

  return {
    totalAgencies: records.length,
    exchangeAgencies: exchangeRecords.length,
    tourismAgencies: tourismRecords.length,
    cityCount: citySet.size,
    regionCount: regions.length,
    latestUpdated: dates.at(-1) ?? null,
    categories: [
      { label: "Intercâmbio", count: exchangeRecords.length, tone: "exchange" },
      { label: "Agências de turismo", count: tourismRecords.length, tone: "tourism" },
    ],
    regions,
    recent,
  };
}

