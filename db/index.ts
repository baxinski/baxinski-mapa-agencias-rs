import { env } from "cloudflare:workers";
import { seedAgencies } from "@/lib/seed";
import { calculateOpportunityScore } from "@/lib/scoring";
import type { Agency, ContactRecord, StatusHistoryRecord, TaskRecord } from "@/lib/types";

type RawAgency = Omit<Agency, "programs" | "belta"> & { programs: string; belta: number | null };

async function ensureColumn(db: D1Database, table: string, column: string, definition: string) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (!info.results.some((item) => item.name === column)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

function database(): D1Database {
  if (!env.DB) throw new Error("Banco D1 indisponível.");
  return env.DB;
}

let databaseReady: Promise<void> | null = null;

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
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, legal_name TEXT, trade_name TEXT NOT NULL,
      city TEXT NOT NULL, region TEXT NOT NULL, address TEXT, phone TEXT, email TEXT, website TEXT,
      instagram TEXT, linkedin TEXT, directors TEXT, owners TEXT, commercial_manager TEXT,
      exchange_lead TEXT, programs TEXT NOT NULL DEFAULT '[]', belta INTEGER, units INTEGER NOT NULL DEFAULT 1,
      audience_profile TEXT NOT NULL, commercial_potential TEXT NOT NULL, notes TEXT,
      verification_status TEXT NOT NULL, source_url TEXT, source_label TEXT, verified_at TEXT, updated_at TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'RS', neighborhood TEXT, cep TEXT, whatsapp TEXT, facebook TEXT, network TEXT,
      commercial_status TEXT NOT NULL DEFAULT 'Não contatada', assigned_to TEXT,
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
  ]);

  const agencyColumns: Array<[string, string]> = [
    ["state", "TEXT NOT NULL DEFAULT 'RS'"], ["neighborhood", "TEXT"], ["cep", "TEXT"], ["whatsapp", "TEXT"], ["facebook", "TEXT"], ["network", "TEXT"],
    ["commercial_status", "TEXT NOT NULL DEFAULT 'Não contatada'"], ["assigned_to", "TEXT"],
    ["opportunity_score", "INTEGER NOT NULL DEFAULT 0"], ["estimated_value", "REAL"],
    ["first_contact_at", "TEXT"], ["last_contact_at", "TEXT"], ["next_follow_up_at", "TEXT"], ["loss_reason", "TEXT"],
    ["google_rating", "REAL"], ["google_review_count", "INTEGER"], ["is_franchise", "INTEGER"],
    ["destinations", "TEXT NOT NULL DEFAULT '[]'"], ["exchange_types", "TEXT NOT NULL DEFAULT '[]'"],
    ["description", "TEXT"], ["hours", "TEXT"], ["logo_url", "TEXT"], ["competitors", "TEXT"], ["products_of_interest", "TEXT"], ["needs", "TEXT"], ["latitude", "REAL"], ["longitude", "REAL"],
  ];
  for (const [column, definition] of agencyColumns) await ensureColumn(db, "agencies", column, definition);
  for (const [column, definition] of [["interaction_type", "TEXT"], ["contact_time", "TEXT"], ["result", "TEXT"], ["next_contact_at", "TEXT"], ["created_by", "TEXT"]] as Array<[string, string]>) await ensureColumn(db, "contacts", column, definition);

  const count = await db.prepare("SELECT COUNT(*) AS total FROM agencies").first<{ total: number }>();
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
  const row = await database().prepare(`${agencySelect} WHERE a.id = ? OR a.slug = ?`).bind(key, key).first<Record<string, unknown>>();
  return row ? normalize(row) : null;
}

export async function saveAgency(item: Agency) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO agencies (
    id, slug, legal_name, trade_name, city, region, address, phone, email, website, instagram, linkedin,
    directors, owners, commercial_manager, exchange_lead, programs, belta, units, audience_profile,
    commercial_potential, notes, verification_status, source_url, source_label, verified_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(item.id, item.slug, item.legalName, item.tradeName, item.city, item.region, item.address, item.phone,
      item.email, item.website, item.instagram, item.linkedin, item.directors, item.owners, item.commercialManager,
      item.exchangeLead, JSON.stringify(item.programs), item.belta === null ? null : Number(item.belta), item.units,
      item.audienceProfile, item.commercialPotential, item.notes, item.verificationStatus, item.sourceUrl,
      item.sourceLabel, item.verifiedAt, item.updatedAt).run();
  await database().prepare(`UPDATE agencies SET opportunity_score=?, commercial_status=?, assigned_to=?, estimated_value=?,
    state=?, neighborhood=?, cep=?, whatsapp=?, facebook=?, network=?, destinations=?, exchange_types=?, description=?, hours=?, logo_url=?, competitors=?, products_of_interest=?, needs=?, latitude=?, longitude=? WHERE id=?`)
    .bind(calculateOpportunityScore(item), item.commercialStatus ?? "Não contatada", item.assignedTo ?? null, item.estimatedValue ?? null,
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
    opportunity_score=?, estimated_value=?, first_contact_at=?, last_contact_at=?, next_follow_up_at=?, loss_reason=?,
    google_rating=?, google_review_count=?, is_franchise=?, destinations=?, exchange_types=?, description=?, hours=?, logo_url=?, competitors=?, products_of_interest=?, needs=?, latitude=?, longitude=? WHERE id=?`)
    .bind(item.state ?? "RS", item.neighborhood ?? null, item.cep ?? null, item.whatsapp ?? null, item.facebook ?? null, item.network ?? null, item.commercialStatus ?? "Não contatada", item.assignedTo ?? null,
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
    interaction_type AS interactionType, contact_time AS contactTime, result, next_contact_at AS nextContactAt, created_by AS createdBy
    FROM contacts WHERE agency_id = ? ORDER BY contact_date DESC, created_at DESC`).bind(agencyId).all<ContactRecord>();
  return result.results;
}

export async function listAllContacts() {
  await ensureDatabase();
  const result = await database().prepare(`SELECT id, agency_id AS agencyId, contact_date AS contactDate,
    channel, contact_name AS contactName, summary, next_step AS nextStep, created_at AS createdAt,
    interaction_type AS interactionType, contact_time AS contactTime, result, next_contact_at AS nextContactAt, created_by AS createdBy
    FROM contacts ORDER BY contact_date DESC, created_at DESC`).all<ContactRecord>();
  return result.results;
}

export async function addContact(contact: ContactRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO contacts (id, agency_id, contact_date, channel, contact_name, summary, next_step, created_at,
    interaction_type, contact_time, result, next_contact_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      contact.id, contact.agencyId, contact.contactDate, contact.channel, contact.contactName, contact.summary, contact.nextStep, contact.createdAt,
      contact.interactionType ?? contact.channel, contact.contactTime ?? null, contact.result ?? null, contact.nextContactAt ?? null, contact.createdBy ?? null).run();
  const current = await getAgency(contact.agencyId);
  const nextStatus = current?.commercialStatus === "Não contatada" ? "Contato iniciado" : (current?.commercialStatus ?? "Contato iniciado");
  await database().prepare(`UPDATE agencies SET last_contact_at=?, first_contact_at=COALESCE(first_contact_at, ?),
    commercial_status=?, opportunity_score=? WHERE id=?`).bind(contact.contactDate, contact.contactDate, nextStatus,
      calculateOpportunityScore({ ...current, commercialStatus: nextStatus, lastContactAt: contact.contactDate }), contact.agencyId).run();
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
    a.trade_name AS agencyName, a.city AS agencyCity
    FROM tasks t JOIN agencies a ON a.id = t.agency_id ORDER BY t.due_at ASC`).all<TaskRecord>();
  return result.results;
}

export async function addTask(task: TaskRecord) {
  await ensureDatabase();
  await database().prepare(`INSERT INTO tasks (id, agency_id, title, description, assigned_to, due_at, priority, status,
    activity_type, notes, completed_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(task.id, task.agencyId, task.title, task.description, task.assignedTo, task.dueAt, task.priority, task.status,
      task.activityType, task.notes, task.completedAt, task.createdAt, task.createdBy).run();
  await database().prepare("UPDATE agencies SET next_follow_up_at=? WHERE id=?").bind(task.dueAt, task.agencyId).run();
  return task;
}

export async function updateTask(id: string, status: TaskRecord["status"], completedAt: string | null) {
  await ensureDatabase();
  await database().prepare("UPDATE tasks SET status=?, completed_at=? WHERE id=?").bind(status, completedAt, id).run();
  return database().prepare("SELECT t.id, t.agency_id AS agencyId, t.title, t.description, t.assigned_to AS assignedTo, t.due_at AS dueAt, t.priority, t.status, t.activity_type AS activityType, t.notes, t.completed_at AS completedAt, t.created_at AS createdAt, t.created_by AS createdBy, a.trade_name AS agencyName, a.city AS agencyCity FROM tasks t JOIN agencies a ON a.id=t.agency_id WHERE t.id=?").bind(id).first<TaskRecord>();
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
