import { env } from "cloudflare:workers";
import { seedAgencies } from "@/lib/seed";
import { calculateOpportunityScore } from "@/lib/scoring";
import type { AccompanimentStatus, Agency, AgencyPlan, AgencySubscription, AnalyticsEventRecord, ContactRecord, LeadRecord, MessageTemplate, StatusHistoryRecord, TaskRecord, UserRoleRecord } from "@/lib/types";

type RawAgency = Omit<Agency, "programs" | "belta"> & { programs: string; belta: number | null };

async function ensureColumns(db: D1Database, table: string, definitions: Array<[string, string]>) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const present = new Set(info.results.map((item) => item.name));
  for (const [column, definition] of definitions) {
    if (!present.has(column)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function database(): D1Database {
  if (!env.DB) throw new Error("Banco D1 indisponível.");
  return env.DB;
}

let databaseReady: Promise<void> | null = null;

const schemaTables = [
  "agencies", "contacts", "agency_status_history", "tasks", "github_sessions",
  "leads", "message_templates", "user_roles", "analytics_events", "agency_plans", "agency_subscriptions",
] as const;

export async function ensureDatabase() {
  if (!databaseReady) databaseReady = initializeDatabase();
  try {
    await databaseReady;
  } catch (error) {
    databaseReady = null;
    throw error;
  }
}

async function initializeDatabase() {
  const db = database();
  // Sites runs workers in short-lived isolates. Avoid replaying the full DDL
  // batch on every request: the repeated schema writes can queue behind D1
  // and leave the dashboard waiting indefinitely.
  const existing = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN (" + schemaTables.map(() => "?").join(",") + ")")
    .bind(...schemaTables).all<{ name: string }>();
  const existingNames = new Set(existing.results.map((item) => item.name));
  const needsBootstrap = schemaTables.some((name) => !existingNames.has(name));

  if (needsBootstrap) await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, legal_name TEXT, trade_name TEXT NOT NULL,
      city TEXT NOT NULL, region TEXT NOT NULL, address TEXT, phone TEXT, email TEXT, website TEXT,
      instagram TEXT, linkedin TEXT, directors TEXT, owners TEXT, commercial_manager TEXT,
      exchange_lead TEXT, programs TEXT NOT NULL DEFAULT '[]', belta INTEGER, units INTEGER NOT NULL DEFAULT 1,
      audience_profile TEXT NOT NULL, commercial_potential TEXT NOT NULL, notes TEXT,
      verification_status TEXT NOT NULL, source_url TEXT, source_label TEXT, verified_at TEXT, updated_at TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'RS', neighborhood TEXT, cep TEXT, whatsapp TEXT, facebook TEXT, network TEXT,
      commercial_status TEXT NOT NULL DEFAULT 'Não contatada', assigned_to TEXT,
      accompaniment_status TEXT NOT NULL DEFAULT 'Não analisada', accompaniment_priority TEXT NOT NULL DEFAULT 'Sem prioridade definida',
      primary_contact_name TEXT, primary_contact_role TEXT, next_action TEXT,
      opportunity_score INTEGER NOT NULL DEFAULT 0, estimated_value REAL,
      first_contact_at TEXT, last_contact_at TEXT, next_follow_up_at TEXT, loss_reason TEXT,
      google_rating REAL, google_review_count INTEGER, is_franchise INTEGER,
      destinations TEXT NOT NULL DEFAULT '[]', exchange_types TEXT NOT NULL DEFAULT '[]',
      description TEXT, hours TEXT, logo_url TEXT, competitors TEXT, products_of_interest TEXT, needs TEXT, latitude REAL, longitude REAL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS agencies_city_idx ON agencies(city)"),
    db.prepare("CREATE INDEX IF NOT EXISTS agencies_potential_idx ON agencies(commercial_potential)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, contact_date TEXT NOT NULL, channel TEXT NOT NULL,
      contact_name TEXT, summary TEXT NOT NULL, next_step TEXT, created_at TEXT NOT NULL,
      interaction_type TEXT, contact_time TEXT, result TEXT, next_contact_at TEXT, created_by TEXT,
      contact_role TEXT, subject TEXT, information_obtained TEXT,
      FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS contacts_agency_idx ON contacts(agency_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS agency_status_history (
      id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, previous_status TEXT, new_status TEXT NOT NULL,
      user_email TEXT, note TEXT, changed_at TEXT NOT NULL,
      FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS agency_status_history_agency_idx ON agency_status_history(agency_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      assigned_to TEXT, due_at TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'Média',
      status TEXT NOT NULL DEFAULT 'Aberta', activity_type TEXT NOT NULL DEFAULT 'Follow-up',
      notes TEXT, completed_at TEXT, created_at TEXT NOT NULL, created_by TEXT,
      result TEXT, next_action TEXT, visit_order INTEGER,
      FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks(due_at, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS tasks_agency_idx ON tasks(agency_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS github_sessions (
      session_id TEXT PRIMARY KEY, github_id TEXT NOT NULL, login TEXT NOT NULL,
      display_name TEXT NOT NULL, email TEXT, avatar_url TEXT,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS github_sessions_expires_idx ON github_sessions(expires_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, whatsapp TEXT NOT NULL, email TEXT NOT NULL,
      city TEXT NOT NULL, destination TEXT NOT NULL, exchange_type TEXT NOT NULL,
      budget_range TEXT, travel_date TEXT, duration TEXT, traveler_age INTEGER, notes TEXT,
      consent INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'public-form',
      status TEXT NOT NULL DEFAULT 'Novo', assigned_to TEXT, matched_agency_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status, created_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS message_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, body TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS message_templates_category_idx ON message_templates(category, active)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_roles (
      user_key TEXT PRIMARY KEY, login TEXT, email TEXT NOT NULL, display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'consulta', active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT, agency_id TEXT, user_email TEXT,
      metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(name, created_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS agency_plans (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL,
      monthly_price REAL, features TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agency_subscriptions (
      id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, plan_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'trial',
      started_at TEXT NOT NULL, ends_at TEXT, external_customer_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES agency_plans(id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS agency_subscriptions_agency_idx ON agency_subscriptions(agency_id, status)"),
  ]);

  const agencyColumns: Array<[string, string]> = [
    ["state", "TEXT NOT NULL DEFAULT 'RS'"], ["neighborhood", "TEXT"], ["cep", "TEXT"], ["whatsapp", "TEXT"], ["facebook", "TEXT"], ["network", "TEXT"],
    ["commercial_status", "TEXT NOT NULL DEFAULT 'Não contatada'"], ["assigned_to", "TEXT"],
    ["accompaniment_status", "TEXT NOT NULL DEFAULT 'Não analisada'"], ["accompaniment_priority", "TEXT NOT NULL DEFAULT 'Sem prioridade definida'"],
    ["primary_contact_name", "TEXT"], ["primary_contact_role", "TEXT"], ["next_action", "TEXT"],
    ["opportunity_score", "INTEGER NOT NULL DEFAULT 0"], ["estimated_value", "REAL"],
    ["first_contact_at", "TEXT"], ["last_contact_at", "TEXT"], ["next_follow_up_at", "TEXT"], ["loss_reason", "TEXT"],
    ["google_rating", "REAL"], ["google_review_count", "INTEGER"], ["is_franchise", "INTEGER"],
    ["destinations", "TEXT NOT NULL DEFAULT '[]'"], ["exchange_types", "TEXT NOT NULL DEFAULT '[]'"],
    ["description", "TEXT"], ["hours", "TEXT"], ["logo_url", "TEXT"], ["competitors", "TEXT"], ["products_of_interest", "TEXT"], ["needs", "TEXT"], ["latitude", "REAL"], ["longitude", "REAL"],
  ];
  // Existing databases created by an older version may need these two
  // compatibility checks, but each table is inspected only once.
  if (existingNames.has("agencies")) await ensureColumns(db, "agencies", agencyColumns);
  if (existingNames.has("contacts")) await ensureColumns(db, "contacts", [["interaction_type", "TEXT"], ["contact_time", "TEXT"], ["result", "TEXT"], ["next_contact_at", "TEXT"], ["created_by", "TEXT"], ["contact_role", "TEXT"], ["subject", "TEXT"], ["information_obtained", "TEXT"]]);
  if (existingNames.has("tasks")) await ensureColumns(db, "tasks", [["result", "TEXT"], ["next_action", "TEXT"], ["visit_order", "INTEGER"]]);
  if (existingNames.has("agencies")) await db.prepare("UPDATE agencies SET accompaniment_status = CASE WHEN accompaniment_status IS NULL OR accompaniment_status = '' THEN CASE WHEN last_contact_at IS NULL THEN 'Não analisada' ELSE 'Contato realizado' END ELSE accompaniment_status END, accompaniment_priority = COALESCE(NULLIF(accompaniment_priority, ''), 'Sem prioridade definida')").run();

  const count = needsBootstrap ? await db.prepare("SELECT COUNT(*) AS total FROM agencies").first<{ total: number }>() : { total: 1 };
  if ((count?.total ?? 0) === 0) {
    await db.batch(seedAgencies.map((item) => db.prepare(`INSERT INTO agencies (
      id, slug, legal_name, trade_name, city, region, address, phone, email, website, instagram, linkedin,
      directors, owners, commercial_manager, exchange_lead, programs, belta, units, audience_profile,
      commercial_potential, notes, verification_status, source_url, source_label, verified_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(item.id, item.slug, item.legalName, item.tradeName, item.city, item.region, item.address, item.phone,
        item.email, item.website, item.instagram, item.linkedin, item.directors, item.owners, item.commercialManager,
        item.exchangeLead, JSON.stringify(item.programs), item.belta === null ? null : Number(item.belta), item.units,
        item.audienceProfile, item.commercialPotential, item.notes, item.verificationStatus, item.sourceUrl,
        item.sourceLabel, item.verifiedAt, item.updatedAt)));
  }

  const templateCount = needsBootstrap ? await db.prepare("SELECT COUNT(*) AS total FROM message_templates").first<{ total: number }>() : { total: 1 };
  if ((templateCount?.total ?? 0) === 0) {
    const now = new Date().toISOString();
    const templates: Array<[string, string, string, string]> = [
      ["tpl-whatsapp-primeiro", "Primeiro contato · WhatsApp", "Primeiro contato por WhatsApp", "Olá, {{agencia}}! Tudo bem? Sou {{vendedor}}, da equipe Mapa de Agências RS. Vi que vocês atuam em {{cidade}} e gostaria de apresentar uma parceria para ampliar as oportunidades de intercâmbio. Podemos conversar?"],
      ["tpl-email-primeiro", "Primeiro contato · e-mail", "Primeiro contato por e-mail", "Olá, {{contato}}.\n\nSou {{vendedor}}, da equipe Mapa de Agências RS. Estamos mapeando parceiros em {{cidade}} e gostaríamos de entender como {{agencia}} trabalha com {{produto}}.\n\nPodemos agendar uma conversa rápida?"],
      ["tpl-followup", "Follow-up sem retorno", "Follow-up", "Olá, {{contato}}! Retomo nossa conversa sobre {{produto}} para saber se este é um bom momento para avançarmos. Fico à disposição e posso enviar a apresentação novamente."],
      ["tpl-reuniao", "Confirmação de reunião", "Reunião", "Olá, {{contato}}! Confirmando nossa reunião de {{data_reuniao}} sobre {{produto}}. Se precisar ajustar o horário, é só me avisar."],
      ["tpl-proposta", "Proposta enviada", "Proposta enviada", "Olá, {{contato}}! A proposta de {{produto}} foi enviada. Posso esclarecer algum ponto ou marcamos um horário para revisar juntos?"],
    ];
    await db.batch(templates.map(([id, name, category, body]) => db.prepare(`INSERT OR IGNORE INTO message_templates (id, name, category, body, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NULL, ?, ?)`)
      .bind(id, name, category, body, now, now)));
  }

  const planCount = needsBootstrap ? await db.prepare("SELECT COUNT(*) AS total FROM agency_plans").first<{ total: number }>() : { total: 1 };
  if ((planCount?.total ?? 0) === 0) {
    const now = new Date().toISOString();
    const plans: Array<[string, string, string, string, number | null]> = [
      ["plan-basico", "basico", "Cadastro básico", "Nome, cidade, contatos e posição normal no diretório", null],
      ["plan-verificado", "verificado", "Perfil verificado", "Selo, página completa, fotos, descrição e botão de orçamento", null],
      ["plan-regional", "regional", "Destaque regional", "Posição superior e destaque por cidade ou região", null],
      ["plan-leads", "leads", "Plano de leads", "Recebimento de contatos, histórico de leads e indicadores", null],
    ];
    await db.batch(plans.map(([id, code, name, description, monthlyPrice]) => db.prepare(`INSERT OR IGNORE INTO agency_plans (id, code, name, description, monthly_price, features, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(id, code, name, description, monthlyPrice, JSON.stringify([]), now, now)));
  }
}

function normalize(row: Record<string, unknown>): Agency {
  const raw = row as unknown as RawAgency & Record<string, unknown>;
  const parseList = (value: unknown) => {
    try { return JSON.parse(String(value || "[]")) as string[]; } catch { return []; }
  };
  return {
    id: String(raw.id), slug: String(raw.slug), legalName: raw.legalName, tradeName: String(raw.tradeName),
    city: String(raw.city), region: String(raw.region), address: raw.address, phone: raw.phone, email: raw.email,
    website: raw.website, instagram: raw.instagram, linkedin: raw.linkedin, directors: raw.directors,
    owners: raw.owners, commercialManager: raw.commercialManager, exchangeLead: raw.exchangeLead,
    programs: parseList(raw.programs), belta: raw.belta === null ? null : Boolean(raw.belta),
    units: Number(raw.units), audienceProfile: String(raw.audienceProfile),
    commercialPotential: raw.commercialPotential, notes: raw.notes, verificationStatus: raw.verificationStatus,
    sourceUrl: raw.sourceUrl, sourceLabel: raw.sourceLabel, verifiedAt: raw.verifiedAt,
    updatedAt: String(raw.updatedAt), contactCount: Number(raw.contactCount ?? 0),
    state: String(raw.state ?? "RS"), neighborhood: raw.neighborhood as string | null, cep: raw.cep as string | null,
    whatsapp: raw.whatsapp as string | null, facebook: raw.facebook as string | null, network: raw.network as string | null,
    commercialStatus: (raw.commercialStatus as Agency["commercialStatus"]) ?? "Não contatada",
    accompanimentStatus: (raw.accompanimentStatus as Agency["accompanimentStatus"]) ?? "Não analisada",
    accompanimentPriority: (raw.accompanimentPriority as Agency["accompanimentPriority"]) ?? "Sem prioridade definida",
    internalOwner: (raw.internalOwner ?? raw.assignedTo) as string | null,
    primaryContactName: raw.primaryContactName as string | null,
    primaryContactRole: raw.primaryContactRole as string | null,
    nextAction: raw.nextAction as string | null,
    assignedTo: raw.assignedTo as string | null, opportunityScore: Number(raw.opportunityScore ?? 0),
    estimatedValue: raw.estimatedValue == null ? null : Number(raw.estimatedValue),
    firstContactAt: raw.firstContactAt as string | null, lastContactAt: raw.lastContactAt as string | null,
    nextFollowUpAt: raw.nextFollowUpAt as string | null, lossReason: raw.lossReason as string | null,
    googleRating: raw.googleRating == null ? null : Number(raw.googleRating), googleReviewCount: raw.googleReviewCount == null ? null : Number(raw.googleReviewCount),
    isFranchise: raw.isFranchise == null ? null : Boolean(raw.isFranchise), destinations: parseList(raw.destinations), exchangeTypes: parseList(raw.exchangeTypes),
    description: raw.description as string | null, hours: raw.hours as string | null, logoUrl: raw.logoUrl as string | null,
    competitors: raw.competitors as string | null, productsOfInterest: raw.productsOfInterest as string | null, needs: raw.needs as string | null,
    latitude: raw.latitude == null ? null : Number(raw.latitude), longitude: raw.longitude == null ? null : Number(raw.longitude),
  };
}

const agencySelect = `SELECT a.id, a.slug, a.legal_name AS legalName, a.trade_name AS tradeName,
  a.city, a.region, a.address, a.phone, a.email, a.website, a.instagram, a.linkedin,
  a.directors, a.owners, a.commercial_manager AS commercialManager, a.exchange_lead AS exchangeLead,
  a.programs, a.belta, a.units, a.audience_profile AS audienceProfile,
  a.commercial_potential AS commercialPotential, a.notes, a.verification_status AS verificationStatus,
  a.source_url AS sourceUrl, a.source_label AS sourceLabel, a.verified_at AS verifiedAt, a.updated_at AS updatedAt,
  a.state, a.neighborhood, a.cep, a.whatsapp, a.facebook, a.network, a.commercial_status AS commercialStatus, a.assigned_to AS assignedTo,
  a.accompaniment_status AS accompanimentStatus, a.accompaniment_priority AS accompanimentPriority,
  a.primary_contact_name AS primaryContactName, a.primary_contact_role AS primaryContactRole, a.next_action AS nextAction,
  a.opportunity_score AS opportunityScore, a.estimated_value AS estimatedValue, a.first_contact_at AS firstContactAt,
  a.last_contact_at AS lastContactAt, a.next_follow_up_at AS nextFollowUpAt, a.loss_reason AS lossReason,
  a.google_rating AS googleRating, a.google_review_count AS googleReviewCount, a.is_franchise AS isFranchise,
  a.destinations, a.exchange_types AS exchangeTypes, a.description, a.hours, a.logo_url AS logoUrl, a.competitors,
  a.products_of_interest AS productsOfInterest, a.needs, a.latitude, a.longitude,
  (SELECT COUNT(*) FROM contacts c WHERE c.agency_id = a.id) AS contactCount FROM agencies a`;

export async function listAgencies() {
  await ensureDatabase();
  const result = await database().prepare(`${agencySelect} ORDER BY a.trade_name`).all<Record<string, unknown>>();
  return result.results.map(normalize);
}

export async function getAgency(key: string) {
  await ensureDatabase();
  const row = await database().prepare(`${agencySelect} WHERE a.id = ? OR a.slug = ?`).bin…444 tokens truncated…Não analisada", item.accompanimentPriority ?? "Sem prioridade definida", item.primaryContactName ?? null, item.primaryContactRole ?? null, item.nextAction ?? null,
      item.state ?? "RS", item.neighborhood ?? null, item.cep ?? null, item.whatsapp ?? null, item.facebook ?? null, item.network ?? null, JSON.stringify(item.destinations ?? []), JSON.stringify(item.exchangeTypes ?? []),
      item.description ?? null, item.hours ?? null, item.logoUrl ?? null, item.competitors ?? null, item.productsOfInterest ?? null, item.needs ?? null, item.latitude ?? null, item.longitude ?? null, item.id).run();
  return getAgency(item.id);
}

export async function updateAgency(id: string, item: Agency) {
  await ensureDatabase();
  await database().prepare(`UPDATE agencies SET slug=?, legal_name=?, trade_name=?, city=?, region=?, address=?,
    phone=?, email=?, website=?, instagram=?, linkedin=?, directors=?, owners=?, commercial_manager=?,
    exchange_lead=?, programs=?, belta=?, units=?, audience_profile=?, commercial_potential=?, notes=?,
    verification_status=?, source_url=?, source_label=?, verified_at=?, updated_at=? WHERE id=?`)
    .bind(item.slug, item.legalName, item.tradeName, item.city, item.region, item.address, item.phone, item.email,
      item.website, item.instagram, item.linkedin, item.directors, item.owners, item.commercialManager,
      item.exchangeLead, JSON.stringify(item.programs), item.belta === null ? null : Number(item.belta), item.units,
      item.audienceProfile, item.commercialPotential, item.notes, item.verificationStatus, item.sourceUrl,
      item.sourceLabel, item.verifiedAt, item.updatedAt, id).run();
  await database().prepare(`UPDATE agencies SET state=?, neighborhood=?, cep=?, whatsapp=?, facebook=?, network=?, commercial_status=?, assigned_to=?,
    accompaniment_status=?, accompaniment_priority=?, primary_contact_name=?, primary_contact_role=?, next_action=?,
    opportunity_score=?, estimated_value=?, first_contact_at=?, last_contact_at=?, next_follow_up_at=?, loss_reason=?,
    google_rating=?, google_review_count=?, is_franchise=?, destinations=?, exchange_types=?, description=?, hours=?, logo_url=?, competitors=?, products_of_interest=?, needs=?, latitude=?, longitude=? WHERE id=?`)
    .bind(item.state ?? "RS", item.neighborhood ?? null, item.cep ?? null, item.whatsapp ?? null, item.facebook ?? null, item.network ?? null, item.commercialStatus ?? "Não contatada", item.assignedTo ?? null,
      item.accompanimentStatus ?? "Não analisada", item.accompanimentPriority ?? "Sem prioridade definida", item.primaryContactName ?? null, item.primaryContactRole ?? null, item.nextAction ?? null,
      calculateOpportunityScore(item), item.estimatedValue ?? null, item.firstContactAt ?? null, item.lastContactAt ?? null,
      item.nextFollowUpAt ?? null, item.lossReason ?? null, item.googleRating ?? null, item.googleReviewCount ?? null,
      item.isFranchise == null ? null : Number(item.isFranchise), JSON.stringify(item.destinations ?? []), JSON.stringify(item.exchangeTypes ?? []),
      item.description ?? null, item.hours ?? null, item.logoUrl ?? null, item.competitors ?? null, item.productsOfInterest ?? null, item.needs ?? null, item.latitude ?? null, item.longitude ?? null, id).run();
  return getAgency(id);
}

export async function listContacts(agencyId: string) {
  await ensureDatabase();
  const result = await database().prepare(`SELECT id, agency_id AS agencyId, contact_date AS contactDate,
    channel, contact_name AS contactName, summary, next_step AS nextStep, created_at AS createdAt,
    interaction_type AS interactionType, contact_time AS contactTime, result, next_contact_at AS nextContactAt, created_by AS createdBy,
    contact_role AS contactRole, subject, information_obtained AS informationObtained
    FROM contacts WHERE agency_id = ? ORDER BY contact_date DESC, created_at DESC`).bind(agencyId).all<ContactRecord>();
  return result.results;
}

export async function listAllContacts() {
  await ensureDatabase();
  const result = await database().prepare(`SELECT id, agency_id AS agencyId, contact_date AS contactDate,
    channel, contact_name AS contactName, summary, next_step AS nextStep, created_at AS createdAt,
    interaction_type AS interactionType, contact_time AS contactTime, result, next_contact_at AS nextContactAt, created_by AS createdBy,
    contact_role AS contactRole, subject, information_obtained AS informationObtained
    FROM contacts ORDER BY contact_date DESC, created_at DESC`).all<ContactRecord>();
  return result.results;
}

export async function addContact(contact: ContactRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO contacts (id, agency_id, contact_date, channel, contact_name, summary, next_step, created_at,
    interaction_type, contact_time, result, next_contact_at, created_by, contact_role, subject, information_obtained) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      contact.id, contact.agencyId, contact.contactDate, contact.channel, contact.contactName, contact.summary, contact.nextStep, contact.createdAt,
      contact.interactionType ?? contact.channel, contact.contactTime ?? null, contact.result ?? null, contact.nextContactAt ?? null, contact.createdBy ?? null,
      contact.contactRole ?? null, contact.subject ?? null, contact.informationObtained ?? null).run();
  const current = await getAgency(contact.agencyId);
  const nextStatus = current?.commercialStatus === "Não contatada" ? "Contato iniciado" : (current?.commercialStatus ?? "Contato iniciado");
  const accompanimentStatus: AccompanimentStatus = contact.nextContactAt ? "Aguardando retorno" : "Contato realizado";
  await database().prepare(`UPDATE agencies SET last_contact_at=?, first_contact_at=COALESCE(first_contact_at, ?),
    commercial_status=?, opportunity_score=?, accompaniment_status=?, next_action=? WHERE id=?`).bind(contact.contactDate, contact.contactDate, nextStatus,
      calculateOpportunityScore({ ...current, commercialStatus: nextStatus, lastContactAt: contact.contactDate }), accompanimentStatus,
      contact.nextStep ?? null, contact.agencyId).run();
  return contact;
}

export async function addStatusHistory(item: StatusHistoryRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO agency_status_history (id, agency_id, previous_status, new_status, user_email, note, changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(item.id, item.agencyId, item.previousStatus, item.newStatus, item.userEmail, item.note, item.changedAt).run();
  return item;
}

export async function listStatusHistory(agencyId: string) {
  await ensureDatabase();
  const result = await database().prepare(`SELECT id, agency_id AS agencyId, previous_status AS previousStatus,
    new_status AS newStatus, user_email AS userEmail, note, changed_at AS changedAt
    FROM agency_status_history WHERE agency_id = ? ORDER BY changed_at DESC`).bind(agencyId).all<StatusHistoryRecord>();
  return result.results;
}

export async function listTasks() {
  await ensureDatabase();
  const result = await database().prepare(`SELECT t.id, t.agency_id AS agencyId, t.title, t.description,
    t.assigned_to AS assignedTo, t.due_at AS dueAt, t.priority, t.status, t.activity_type AS activityType,
    t.notes, t.completed_at AS completedAt, t.created_at AS createdAt, t.created_by AS createdBy,
    t.result, t.next_action AS nextAction, t.visit_order AS visitOrder,
    a.trade_name AS agencyName, a.city AS agencyCity
    FROM tasks t JOIN agencies a ON a.id = t.agency_id ORDER BY t.due_at ASC`).all<TaskRecord>();
  return result.results;
}

export async function addTask(task: TaskRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO tasks (id, agency_id, title, description, assigned_to, due_at, priority, status,
    activity_type, notes, completed_at, created_at, created_by, result, next_action, visit_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(task.id, task.agencyId, task.title, task.description, task.assignedTo, task.dueAt, task.priority, task.status,
      task.activityType, task.notes, task.completedAt, task.createdAt, task.createdBy, task.result ?? null, task.nextAction ?? null, task.visitOrder ?? null).run();
  const nextStatus: AccompanimentStatus = task.activityType === "Visita" ? "Visita planejada" : task.activityType === "Reunião" ? "Reunião agendada" : "Aguardando retorno";
  await database().prepare("UPDATE agencies SET next_follow_up_at=?, accompaniment_status=?, next_action=? WHERE id=?").bind(task.dueAt, nextStatus, task.nextAction ?? task.title, task.agencyId).run();
  return task;
}

export async function updateTask(id: string, status: TaskRecord["status"], completedAt: string | null) {
  await ensureDatabase();
  await database().prepare("UPDATE tasks SET status=?, completed_at=? WHERE id=?").bind(status, completedAt, id).run();
  return database().prepare("SELECT t.id, t.agency_id AS agencyId, t.title, t.description, t.assigned_to AS assignedTo, t.due_at AS dueAt, t.priority, t.status, t.activity_type AS activityType, t.notes, t.completed_at AS completedAt, t.created_at AS createdAt, t.created_by AS createdBy, t.result, t.next_action AS nextAction, t.visit_order AS visitOrder, a.trade_name AS agencyName, a.city AS agencyCity FROM tasks t JOIN agencies a ON a.id=t.agency_id WHERE t.id=?").bind(id).first<TaskRecord>();
}

export async function getCommercialSummary() {
  await ensureDatabase();
  const [contacts, tasks] = await Promise.all([listAllContacts(), listTasks()]);
  return { contacts, tasks };
}

export type GithubSessionRecord = {
  sessionId: string;
  githubId: string;
  login: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  expiresAt: string;
};

export async function saveGithubSession(session: GithubSessionRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO github_sessions
    (session_id, github_id, login, display_name, email, avatar_url, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET github_id=excluded.github_id, login=excluded.login,
    display_name=excluded.display_name, email=excluded.email, avatar_url=excluded.avatar_url,
    created_at=excluded.created_at, expires_at=excluded.expires_at`)
    .bind(session.sessionId, session.githubId, session.login, session.displayName, session.email, session.avatarUrl, session.createdAt, session.expiresAt).run();
  return session;
}

export async function getGithubSession(sessionId: string) {
  await ensureDatabase();
  const row = await database().prepare(`SELECT session_id AS sessionId, github_id AS githubId,
    login, display_name AS displayName, email, avatar_url AS avatarUrl,
    created_at AS createdAt, expires_at AS expiresAt FROM github_sessions WHERE session_id = ?`)
    .bind(sessionId).first<GithubSessionRecord>();
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await deleteGithubSession(sessionId);
    return null;
  }
  return row;
}

export async function deleteGithubSession(sessionId: string) {
  await ensureDatabase();
  await database().prepare("DELETE FROM github_sessions WHERE session_id = ?").bind(sessionId).run();
}

function parseStringList(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function addLead(lead: LeadRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO leads (
    id, name, whatsapp, email, city, destination, exchange_type, budget_range, travel_date,
    duration, traveler_age, notes, consent, source, status, assigned_to, matched_agency_ids, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(lead.id, lead.name, lead.whatsapp, lead.email, lead.city, lead.destination, lead.exchangeType,
      lead.budgetRange, lead.travelDate, lead.duration, lead.travelerAge, lead.notes, lead.consent ? 1 : 0,
      lead.source, lead.status, lead.assignedTo, JSON.stringify(lead.matchedAgencyIds), lead.createdAt, lead.updatedAt).run();
  return lead;
}

export async function listLeads() {
  await ensureDatabase();
  const result = await database().prepare(`SELECT id, name, whatsapp, email, city, destination,
    exchange_type AS exchangeType, budget_range AS budgetRange, travel_date AS travelDate,
    duration, traveler_age AS travelerAge, notes, consent, source, status, assigned_to AS assignedTo,
    matched_agency_ids AS matchedAgencyIds, created_at AS createdAt, updated_at AS updatedAt
    FROM leads ORDER BY created_at DESC`).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    ...row,
    consent: Boolean(row.consent),
    travelerAge: row.travelerAge == null ? null : Number(row.travelerAge),
    matchedAgencyIds: parseStringList(row.matchedAgencyIds),
  })) as LeadRecord[];
}

export async function updateLead(id: string, fields: Pick<LeadRecord, "status" | "assignedTo">) {
  await ensureDatabase();
  const now = new Date().toISOString();
  await database().prepare("UPDATE leads SET status=?, assigned_to=?, updated_at=? WHERE id=?")
    .bind(fields.status, fields.assignedTo, now, id).run();
  const rows = await listLeads();
  return rows.find((row) => row.id === id) ?? null;
}

export async function listMessageTemplates(includeInactive = false) {
  await ensureDatabase();
  const result = await database().prepare(`SELECT id, name, category, body, active,
    created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
    FROM message_templates ${includeInactive ? "" : "WHERE active = 1"} ORDER BY category, name`).all<Omit<MessageTemplate, "active"> & { active: number }>();
  return result.results.map((row) => ({ ...row, active: Boolean(row.active) }));
}

export async function saveMessageTemplate(template: MessageTemplate) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO message_templates (id, name, category, body, active, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, body=excluded.body,
    active=excluded.active, updated_at=excluded.updated_at`).bind(
      template.id, template.name, template.category, template.body, template.active ? 1 : 0,
      template.createdBy, template.createdAt, template.updatedAt).run();
  const rows = await listMessageTemplates(true);
  return rows.find((row) => row.id === template.id) ?? null;
}

export async function deleteMessageTemplate(id: string) {
  await ensureDatabase();
  await database().prepare("DELETE FROM message_templates WHERE id=?").bind(id).run();
}

export async function getUserRole(userKey: string) {
  await ensureDatabase();
  return database().prepare(`SELECT user_key AS userKey, login, email, display_name AS displayName,
    role, active, created_at AS createdAt, updated_at AS updatedAt FROM user_roles WHERE user_key=?`).bind(userKey).first<Omit<UserRoleRecord, "active"> & { active: number }>();
}

export async function listUserRoles() {
  await ensureDatabase();
  const result = await database().prepare(`SELECT user_key AS userKey, login, email, display_name AS displayName,
    role, active, created_at AS createdAt, updated_at AS updatedAt FROM user_roles ORDER BY display_name`).all<Omit<UserRoleRecord, "active"> & { active: number }>();
  return result.results.map((row) => ({ ...row, active: Boolean(row.active) }));
}

export async function saveUserRole(record: UserRoleRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO user_roles (user_key, login, email, display_name, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_key) DO UPDATE SET login=excluded.login, email=excluded.email,
    display_name=excluded.display_name, role=excluded.role, active=excluded.active, updated_at=excluded.updated_at`).bind(
      record.userKey, record.login, record.email, record.displayName, record.role, record.active ? 1 : 0,
      record.createdAt, record.updatedAt).run();
  const saved = await getUserRole(record.userKey);
  return saved ? { ...saved, active: Boolean(saved.active) } : null;
}

export async function addAnalyticsEvent(event: AnalyticsEventRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO analytics_events (id, name, path, agency_id, user_email, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(event.id, event.name, event.path, event.agencyId, event.userEmail,
      JSON.stringify(event.metadata ?? {}), event.createdAt).run();
  return event;
}

export async function summarizeAnalytics(days = 30) {
  await ensureDatabase();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const result = await database().prepare(`SELECT name, COUNT(*) AS value FROM analytics_events WHERE created_at >= ? GROUP BY name ORDER BY value DESC`).bind(since).all<{ name: string; value: number }>();
  return result.results.map((row) => ({ label: row.name, value: Number(row.value) }));
}

export async function listAgencyPlans(includeInactive = false) {
  await ensureDatabase();
  const result = await database().prepare(`SELECT id, code, name, description, monthly_price AS monthlyPrice, features, active,
    created_at AS createdAt, updated_at AS updatedAt FROM agency_plans ${includeInactive ? "" : "WHERE active = 1"} ORDER BY id`).all<Record<string, unknown>>();
  return result.results.map((row) => ({ ...row, monthlyPrice: row.monthlyPrice == null ? null : Number(row.monthlyPrice), features: parseStringList(row.features), active: Boolean(row.active) })) as AgencyPlan[];
}

export async function saveAgencyPlan(plan: AgencyPlan) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO agency_plans (id, code, name, description, monthly_price, features, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET code=excluded.code, name=excluded.name,
    description=excluded.description, monthly_price=excluded.monthly_price, features=excluded.features, active=excluded.active, updated_at=excluded.updated_at`)
    .bind(plan.id, plan.code, plan.name, plan.description, plan.monthlyPrice, JSON.stringify(plan.features), plan.active ? 1 : 0, plan.createdAt, plan.updatedAt).run();
  return (await listAgencyPlans(true)).find((item) => item.id === plan.id) ?? null;
}

export async function listAgencySubscriptions() {
  await ensureDatabase();
  const result = await database().prepare(`SELECT s.id, s.agency_id AS agencyId, s.plan_id AS planId, s.status,
    s.started_at AS startedAt, s.ends_at AS endsAt, s.external_customer_id AS externalCustomerId,
    s.created_at AS createdAt, s.updated_at AS updatedAt, a.trade_name AS agencyName, p.name AS planName
    FROM agency_subscriptions s JOIN agencies a ON a.id=s.agency_id JOIN agency_plans p ON p.id=s.plan_id ORDER BY s.updated_at DESC`).all<AgencySubscription>();
  return result.results;
}

export async function saveAgencySubscription(subscription: AgencySubscription) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO agency_subscriptions (id, agency_id, plan_id, status, started_at, ends_at, external_customer_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET plan_id=excluded.plan_id, status=excluded.status,
    started_at=excluded.started_at, ends_at=excluded.ends_at, external_customer_id=excluded.external_customer_id, updated_at=excluded.updated_at`)
    .bind(subscription.id, subscription.agencyId, subscription.planId, subscription.status, subscription.startedAt, subscription.endsAt, subscription.externalCustomerId, subscription.createdAt, subscription.updatedAt).run();
  return (await listAgencySubscriptions()).find((item) => item.id === subscription.id) ?? null;
}

