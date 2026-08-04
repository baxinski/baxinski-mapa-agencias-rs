import { getAgency, saveAgency } from "@/db";
import { regionForCity } from "@/lib/regional";
import { activeTourismAgencies } from "@/lib/tourism";
import { accompanimentPriorities, accompanimentStatuses, type AccompanimentAgency, type AccompanimentPriority, type AccompanimentStatus, type Agency } from "@/lib/types";

export const defaultAccompanimentStatus: AccompanimentStatus = accompanimentStatuses[0];
export const defaultAccompanimentPriority: AccompanimentPriority = accompanimentPriorities[3];

export async function ensureTourismShadowAgency(value: string) {
  if (!value.startsWith("tourism:")) return value;
  const sourceId = value.slice("tourism:".length);
  const source = activeTourismAgencies.find((agency) => agency.id === sourceId);
  if (!source) throw new Error("Agência de turismo não encontrada na base ativa.");
  if (await getAgency(value)) return value;
  const now = new Date().toISOString().slice(0, 10);
  const item: Agency = {
    id: value,
    slug: `turismo-${source.id}`,
    legalName: source.legalName,
    tradeName: source.tradeName === "*" ? source.legalName ?? "Agência sem nome divulgado" : source.tradeName,
    city: source.city,
    region: regionForCity(source.city),
    state: source.state,
    neighborhood: source.neighborhood,
    cep: source.cep,
    address: source.address,
    phone: source.phone,
    email: null,
    website: source.website,
    instagram: null,
    linkedin: null,
    directors: null,
    owners: null,
    commercialManager: null,
    exchangeLead: null,
    programs: [source.activity],
    belta: null,
    units: 1,
    audienceProfile: "Agência de turismo cadastrada no Cadastur",
    commercialPotential: "C",
    commercialStatus: "Não contatada",
    accompanimentStatus: defaultAccompanimentStatus,
    accompanimentPriority: defaultAccompanimentPriority,
    notes: null,
    verificationStatus: "Verificado",
    sourceUrl: source.sourceUrl,
    sourceLabel: source.sourceLabel,
    verifiedAt: source.verifiedAt,
    updatedAt: now,
    whatsapp: null,
    facebook: null,
    network: null,
    destinations: [],
    exchangeTypes: [],
    description: source.activity,
    hours: null,
  };
  await saveAgency(item);
  return value;
}

export function completenessForAgency(agency: Pick<Agency, "address" | "phone" | "email" | "website" | "instagram" | "programs" | "directors" | "owners" | "notes" | "primaryContactName">) {
  const fields: Array<[string, unknown]> = [
    ["Endereço", agency.address], ["Telefone", agency.phone], ["E-mail", agency.email], ["Site", agency.website],
    ["Instagram", agency.instagram], ["Programas", agency.programs?.length ? agency.programs.join(", ") : null],
    ["Contato responsável", agency.primaryContactName ?? agency.directors ?? agency.owners], ["Observações", agency.notes],
  ];
  const missingFields = fields.filter(([, value]) => !String(value ?? "").trim()).map(([label]) => label);
  return { completeness: Math.round(((fields.length - missingFields.length) / fields.length) * 100), missingFields };
}

export function normalizeAccompanimentStatus(value: unknown): AccompanimentStatus {
  return (accompanimentStatuses as readonly string[]).includes(String(value)) ? value as AccompanimentStatus : defaultAccompanimentStatus;
}

export function normalizeAccompanimentPriority(value: unknown): AccompanimentPriority {
  return (accompanimentPriorities as readonly string[]).includes(String(value)) ? value as AccompanimentPriority : defaultAccompanimentPriority;
}

export function toAccompanimentAgency(agency: Agency, kind: AccompanimentAgency["agencyKind"], stats?: { openTaskCount?: number; overdueTaskCount?: number; lastContactAt?: string | null; nextContactAt?: string | null }): AccompanimentAgency {
  const { completeness, missingFields } = completenessForAgency(agency);
  const contactPerson = agency.primaryContactName ?? agency.directors ?? agency.owners ?? agency.commercialManager ?? null;
  return {
    ...agency,
    agencyKind: kind,
    accompanimentStatus: normalizeAccompanimentStatus(agency.accompanimentStatus),
    accompanimentPriority: normalizeAccompanimentPriority(agency.accompanimentPriority),
    completeness,
    missingFields,
    lastContactAt: stats?.lastContactAt ?? agency.lastContactAt ?? null,
    nextContactAt: stats?.nextContactAt ?? agency.nextFollowUpAt ?? null,
    openTaskCount: stats?.openTaskCount ?? 0,
    overdueTaskCount: stats?.overdueTaskCount ?? 0,
    contactPerson,
    contactRole: agency.primaryContactRole ?? (agency.commercialManager ? "Responsável comercial" : null),
  };
}

