export type Potential = "A" | "B" | "C";
export type VerificationStatus = "Verificado" | "Revisar";
export const commercialStatuses = [
  "Não contatada",
  "Contato iniciado",
  "Aguardando retorno",
  "Reunião agendada",
  "Oportunidade qualificada",
  "Proposta enviada",
  "Em negociação",
  "Cliente",
  "Sem interesse",
  "Inativa",
] as const;
export type CommercialStatus = (typeof commercialStatuses)[number];
export type TaskPriority = "Baixa" | "Média" | "Alta" | "Urgente";
export type TaskStatus = "Aberta" | "Concluída" | "Cancelada";
export type UserRole = "admin" | "gestor" | "vendedor" | "consulta";

export const userRoles: UserRole[] = ["admin", "gestor", "vendedor", "consulta"];

export interface Agency {
  id: string;
  slug: string;
  legalName: string | null;
  tradeName: string;
  city: string;
  region: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  directors: string | null;
  owners: string | null;
  commercialManager: string | null;
  exchangeLead: string | null;
  programs: string[];
  belta: boolean | null;
  units: number;
  audienceProfile: string;
  commercialPotential: Potential;
  notes: string | null;
  verificationStatus: VerificationStatus;
  sourceUrl: string | null;
  sourceLabel: string | null;
  verifiedAt: string | null;
  updatedAt: string;
  contactCount?: number;
  state?: string;
  neighborhood?: string | null;
  cep?: string | null;
  whatsapp?: string | null;
  facebook?: string | null;
  network?: string | null;
  commercialStatus?: CommercialStatus;
  assignedTo?: string | null;
  opportunityScore?: number;
  estimatedValue?: number | null;
  firstContactAt?: string | null;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
  lossReason?: string | null;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  isFranchise?: boolean | null;
  destinations?: string[];
  exchangeTypes?: string[];
  description?: string | null;
  hours?: string | null;
  logoUrl?: string | null;
  competitors?: string | null;
  productsOfInterest?: string | null;
  needs?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ContactRecord {
  id: string;
  agencyId: string;
  contactDate: string;
  channel: string;
  contactName: string | null;
  summary: string;
  nextStep: string | null;
  createdAt: string;
  interactionType?: string | null;
  contactTime?: string | null;
  result?: string | null;
  nextContactAt?: string | null;
  createdBy?: string | null;
}

export interface StatusHistoryRecord {
  id: string;
  agencyId: string;
  previousStatus: CommercialStatus | null;
  newStatus: CommercialStatus;
  userEmail: string | null;
  note: string | null;
  changedAt: string;
}

export interface TaskRecord {
  id: string;
  agencyId: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  dueAt: string;
  priority: TaskPriority;
  status: TaskStatus;
  activityType: string;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  agencyName?: string;
  agencyCity?: string;
}

export interface DashboardResponse {
  metrics: {
    totalAgencies: number;
    exchangeAgencies: number;
    tourismAgencies: number;
    notContacted: number;
    contacted: number;
    opportunities: number;
    meetings: number;
    proposals: number;
    negotiations: number;
    clients: number;
    discarded: number;
    contactsLast7Days: number;
    overdueFollowUps: number;
    todayFollowUps: number;
    conversionRate: number;
    pipelineValue: number;
  };
  charts: {
    byCity: Array<{ label: string; value: number }>;
    byRegion: Array<{ label: string; value: number }>;
    byStatus: Array<{ label: string; value: number }>;
    contactsByDay: Array<{ label: string; value: number }>;
    pipelineByStatus: Array<{ label: string; value: number }>;
  };
  priorityAgencies: Agency[];
  overdueTasks: TaskRecord[];
  todayTasks: TaskRecord[];
}

export interface TourismAgency {
  id: string;
  cadasturNumber: string;
  legalName: string | null;
  tradeName: string;
  city: string;
  state: string;
  address: string | null;
  neighborhood: string | null;
  cep: string | null;
  phone: string | null;
  website: string | null;
  activityCode: number | null;
  activity: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  sourceUrl: string;
  sourceLabel: string;
  verifiedAt: string;
}

export type RegionalKind = "exchange" | "tourism";

export interface RegionalRecord {
  id: string;
  kind: RegionalKind;
  name: string;
  legalName: string | null;
  city: string;
  region: string;
  summary: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  href: string;
  sourceUrl: string | null;
  commercialStatus?: CommercialStatus;
}

export interface RegionalGroup {
  region: string;
  count: number;
  cities: string[];
  dominantStatus?: CommercialStatus | null;
}

export interface RegionalResponse {
  records: RegionalRecord[];
  total: number;
  exchangeCount: number;
  tourismCount: number;
  hasMore: boolean;
  regions: RegionalGroup[];
  cities: string[];
  availableRegions: string[];
}

export interface LeadRecord {
  id: string;
  name: string;
  whatsapp: string;
  email: string;
  city: string;
  destination: string;
  exchangeType: string;
  budgetRange: string | null;
  travelDate: string | null;
  duration: string | null;
  travelerAge: number | null;
  notes: string | null;
  consent: boolean;
  source: string;
  status: "Novo" | "Em atendimento" | "Distribuído" | "Convertido" | "Arquivado";
  assignedTo: string | null;
  matchedAgencyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory =
  | "Primeiro contato por WhatsApp"
  | "Primeiro contato por e-mail"
  | "Apresentação comercial"
  | "Follow-up"
  | "Reunião"
  | "Proposta enviada"
  | "Retomada de contato"
  | "Agência sem retorno"
  | "Pós-reunião"
  | "Fechamento";

export const templateCategories: TemplateCategory[] = [
  "Primeiro contato por WhatsApp", "Primeiro contato por e-mail", "Apresentação comercial", "Follow-up",
  "Reunião", "Proposta enviada", "Retomada de contato", "Agência sem retorno", "Pós-reunião", "Fechamento",
];

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleRecord {
  userKey: string;
  login: string | null;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsEventRecord {
  id: string;
  name: string;
  path: string | null;
  agencyId: string | null;
  userEmail: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export type AgencyPlanCode = "basico" | "verificado" | "regional" | "leads";

export interface AgencyPlan {
  id: string;
  code: AgencyPlanCode;
  name: string;
  description: string;
  monthlyPrice: number | null;
  features: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgencySubscription {
  id: string;
  agencyId: string;
  planId: string;
  status: "trial" | "active" | "paused" | "cancelled";
  startedAt: string;
  endsAt: string | null;
  externalCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  agencyName?: string;
  planName?: string;
}
