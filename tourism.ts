import rawTourismAgencies from "@/lib/turismo-seed.json";
import type { TourismAgency } from "@/lib/types";

export const tourismAgencies = rawTourismAgencies as TourismAgency[];

export const tourismSource = {
  label: "Cadastur — consulta pública",
  url: "https://cadastur.turismo.gov.br/hotsite/#!/public/sou-turista/inicio",
  apiUrl: "https://cadastur.turismo.gov.br/cadastur-backend/rest/portal/obterDadosPrestadores",
  verifiedAt: "2026-08-03",
  datasetLabel: "Agências de Turismo · Rio Grande do Sul",
  activeRule: "Situação Regular e validade do certificado até a data da consulta",
};

export function isActiveTourismAgency(agency: TourismAgency) {
  return agency.status === "Regular" && (agency.expiresAt ?? "") >= tourismSource.verifiedAt;
}

export const activeTourismAgencies = tourismAgencies.filter(isActiveTourismAgency);
