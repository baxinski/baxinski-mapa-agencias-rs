import { env } from "cloudflare:workers";
import { seedAgencies } from "@/lib/seed";
import { calculateOpportunityScore } from "@/lib/scoring";
import type { Agency, AgencyPlan, AgencySubscription, AnalyticsEventRecord, ContactRecord, LeadRecord, MessageTemplate, StatusHistoryRecord, TaskRecord, UserRoleRecord } from "@/lib/types";

type RawAgency = Omit<Agency, "programs" | "belta"> & { programs: string; belta: number | null };

async function ensureColumns(db: D1Database, table: string, definitions: Array<[string, string]>) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const present = new Set(info.results.map((item) => item.name));
  for (const [column, definition] of definitions) {
    if (!present.has(column)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function database(): D1Database {
  if (!env.DB) throw new Error("Banco D1 indispon√≠vel.");
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
      commercial_status TEXT NOT NULL DEFAULT 'N√£o contatada', assigned_to TEXT,
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
      assigned_to TEXT, due_at TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'M√©dia',
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
    ["commercial_status", "TEXT NOT NULL DEFAULT 'N√£o contatada'"], ["assigned_to", "TEXT"],
    ["opportunity_score", "INTEGER NOT NULL DEFAULT 0"], ["estimated_value", "REAL"],
    ["first_contact_at", "TEXT"], ["last_contact_at", "TEXT"], ["next_follow_up_at", "TEXT"], ["loss_reason", "TEXT"],
    ["google_rating", "REAL"], ["google_review_count", "INTEGER"], ["is_franchise", "INTEGER"],
    ["destinations", "TEXT NOT NULL DEFAULT '[]'"], ["exchange_types", "TEXT NOT NULL DEFAULT '[]'"],
    ["description", "TEXT"], ["hours", "TEXT"], ["logo_url", "TEXT"], ["competitors", "TEXT"], ["products_of_interest", "TEXT"], ["needs", "TEXT"], ["latitude", "REAL"], ["longitude", "REAL"],
  ];
  // Existing databases created by an older version may need these two
  // compatibility checks, but each table is inspected only once.
  if (existingNames.has("agencies")) await ensureColumns(db, "agencies", agencyColumns);
  if (existingNames.has("contacts")) await ensureColumns(db, "contacts", [["interaction_type", "TEXT"], ["contact_time", "TEXT"], ["result", "TEXT"], ["next_contact_at", "TEXT"], ["created_by", "TEXT"]]);

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
      ["tpl-whatsapp-primeiro", "Primeiro contato ¬∑ WhatsApp", "Primeiro contato por WhatsApp", "Ol√°, {{agencia}}! Tudo bem? Sou {{vendedor}}, da equipe Mapa de Ag√™ncias RS. Vi que voc√™s atuam em {{cidade}} e gostaria de apresentar uma parceria para ampliar as oportunidades de interc√¢mbio. Podemos conversar?"],
      ["tpl-email-primeiro", "Primeiro contato ¬∑ e-mail", "Primeiro contato por e-mail", "Ol√°, {{contato}}.\n\nSou {{vendedor}}, da equipe Mapa de Ag√™ncias RS. Estamos mapeando parceiros em {{cidade}} e gostar√≠amos de entender como {{agencia}} trabalha com {{produto}}.\n\nPodemos agendar uma conversa r√°pida?"],
      ["tpl-followup", "Follow-up sem retorno", "Follow-up", "Ol√°, {{contato}}! Retomo nossa conversa sobre {{produto}} para saber se este √© um bom momento para avan√ßarmos. Fico √† disposi√ß√£o e posso enviar a apresenta√ß√£o novamente."],
      ["tpl-reuniao", "Confirma√ß√£o de reuni√£o", "Reuni√£o", "Ol√°, {{contato}}! Confirmando nossa reuni√£o de {{data_reuniao}} sobre {{produto}}. Se precisar ajustar o hor√°rio, √© s√≥ me avisar."],
      ["tpl-proposta", "Proposta enviada", "Proposta enviada", "Ol√°, {{contato}}! A proposta de {{produto}} foi enviada. Posso esclarecer algum ponto ou marcamos um hor√°rio para revisar juntos?"],
    ];
    await db.batch(templates.map(([id, name, category, body]) => db.prepare(`INSERT OR IGNORE INTO message_templates (id, name, category, body, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NULL, ?, ?)`)
      .bind(id, name, category, body, now, now)));
  }

  const planCount = needsBootstrap ? await db.prepare("SELECT COUNT(*) AS total FROM agency_plans").first<{ total: number }>() : { total: 1 };
  if ((planCount?.total ?? 0) === 0) {
    const now = new Date().toISOString();
    const plans: Array<[string, string, string, string, number | null]> = [
      ["plan-basico", "basico", "Cadastro b√°sico", "Nome, cidade, contatos e posi√ß√£o normal no diret√≥rio", null],
      ["plan-verificado", "verificado", "Perfil verificado", "Selo, p√°gina completa, fotos, descri√ß√£o e bot√£o de or√ßamento", null],
      ["plan-regional", "regional", "Destaque regional", "Posi√ß√£o superior e destaque por cidade ou regi√£o", null],
      ["plan-leads", "leads", "Plano de leads", "Recebimento de contatos, hist√≥rico de leads e indicadores", null],
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
    whatsapp:€Ω∂∂âûÀk∫wµÁAÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅ•ê∞ÅÖùïπçÂ}•êÅLÅÖùïπçÂ%ê∞ÅçΩπ—Öç—}ëÖ—îÅLÅçΩπ—Öç—Ö—î∞(ÄÄÄÅç°Öππï∞∞ÅçΩπ—Öç—}πÖµîÅLÅçΩπ—Öç—9Öµî∞ÅÕ’µµÖ…‰∞Åπï·—}Õ—ï¿ÅLÅπï·—M—ï¿∞Åç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞(ÄÄÄÅ•π—ï…Öç—•Ωπ}—Â¡îÅLÅ•π—ï…Öç—•ΩπQÂ¡î∞ÅçΩπ—Öç—}—•µîÅLÅçΩπ—Öç—Q•µî∞Å…ïÕ’±–∞Åπï·—}çΩπ—Öç—}Ö–ÅLÅπï·—Ωπ—Öç—–∞Åç…ïÖ—ïë}â‰ÅLÅç…ïÖ—ïë	‰(ÄÄÄÅI=4ÅçΩπ—Öç—ÃÅ=IHÅ	dÅçΩπ—Öç—}ëÖ—îÅM∞Åç…ïÖ—ïë}Ö–ÅMÄ§πÖ±∞ÒΩπ—Öç—IïçΩ…ê¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃÏ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÖëëΩπ—Öç–°çΩπ—Öç–ËÅΩπ—Öç—IïçΩ…ê§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<ÅçΩπ—Öç—ÃÄ°•ê∞ÅÖùïπçÂ}•ê∞ÅçΩπ—Öç—}ëÖ—î∞Åç°Öππï∞∞ÅçΩπ—Öç—}πÖµî∞ÅÕ’µµÖ…‰∞Åπï·—}Õ—ï¿∞Åç…ïÖ—ïë}Ö–∞(ÄÄÄÅ•π—ï…Öç—•Ωπ}—Â¡î∞ÅçΩπ—Öç—}—•µî∞Å…ïÕ’±–∞Åπï·—}çΩπ—Öç—}Ö–∞Åç…ïÖ—ïë}â‰§ÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸•Ä§πâ•πê†(ÄÄÄÄÄÅçΩπ—Öç–π•ê∞ÅçΩπ—Öç–πÖùïπçÂ%ê∞ÅçΩπ—Öç–πçΩπ—Öç—Ö—î∞ÅçΩπ—Öç–πç°Öππï∞∞ÅçΩπ—Öç–πçΩπ—Öç—9Öµî∞ÅçΩπ—Öç–πÕ’µµÖ…‰∞ÅçΩπ—Öç–ππï·—M—ï¿∞ÅçΩπ—Öç–πç…ïÖ—ïë–∞(ÄÄÄÄÄÅçΩπ—Öç–π•π—ï…Öç—•ΩπQÂ¡îÄ¸¸ÅçΩπ—Öç–πç°Öππï∞∞ÅçΩπ—Öç–πçΩπ—Öç—Q•µîÄ¸¸Åπ’±∞∞ÅçΩπ—Öç–π…ïÕ’±–Ä¸¸Åπ’±∞∞ÅçΩπ—Öç–ππï·—Ωπ—Öç—–Ä¸¸Åπ’±∞∞ÅçΩπ—Öç–πç…ïÖ—ïë	‰Ä¸¸Åπ’±∞§π…’∏†§Ï(ÄÅçΩπÕ–Åç’……ïπ–ÄÙÅÖ›Ö•–Åùï—ùïπç‰°çΩπ—Öç–πÖùïπçÂ%ê§Ï(ÄÅçΩπÕ–Åπï·—M—Ö—’ÃÄÙÅç’……ïπ–¸πçΩµµï…ç•Ö±M—Ö—’ÃÄÙÙÙÄâ;çºÅçΩπ—Ö—ÖëÑàÄ¸ÄâΩπ—Ö—ºÅ•π•ç•ÖëºàÄËÄ°ç’……ïπ–¸πçΩµµï…ç•Ö±M—Ö—’ÃÄ¸¸ÄâΩπ—Ö—ºÅ•π•ç•Öëºà§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅUAQÅÖùïπç•ïÃÅMPÅ±ÖÕ—}çΩπ—Öç—}Ö–Ù¸∞Åô•…Õ—}çΩπ—Öç—}Ö–ı=1M°ô•…Õ—}çΩπ—Öç—}Ö–∞Ä¸§∞(ÄÄÄÅçΩµµï…ç•Ö±}Õ—Ö—’ÃÙ¸∞ÅΩ¡¡Ω…—’π•—Â}ÕçΩ…îÙ¸Å]!IÅ•êÙ˝Ä§πâ•πê°çΩπ—Öç–πçΩπ—Öç—Ö—î∞ÅçΩπ—Öç–πçΩπ—Öç—Ö—î∞Åπï·—M—Ö—’Ã∞(ÄÄÄÄÄÅçÖ±ç’±Ö—ï=¡¡Ω…—’π•—ÂMçΩ…î°ÏÄ∏∏πç’……ïπ–∞ÅçΩµµï…ç•Ö±M—Ö—’ÃËÅπï·—M—Ö—’Ã∞Å±ÖÕ—Ωπ—Öç—–ËÅçΩπ—Öç–πçΩπ—Öç—Ö—îÅÙ§∞ÅçΩπ—Öç–πÖùïπçÂ%ê§π…’∏†§Ï(ÄÅ…ï—’…∏ÅçΩπ—Öç–Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÖëëM—Ö—’Õ!•Õ—Ω…‰°•—ï¥ËÅM—Ö—’Õ!•Õ—Ω…ÂIïçΩ…ê§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<ÅÖùïπçÂ}Õ—Ö—’Õ}°•Õ—Ω…‰Ä°•ê∞ÅÖùïπçÂ}•ê∞Å¡…ïŸ•Ω’Õ}Õ—Ö—’Ã∞Åπï›}Õ—Ö—’Ã∞Å’Õï…}ïµÖ•∞∞ÅπΩ—î∞Åç°Öπùïë}Ö–§(ÄÄÄÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸•Ä§πâ•πê°•—ï¥π•ê∞Å•—ï¥πÖùïπçÂ%ê∞Å•—ï¥π¡…ïŸ•Ω’ÕM—Ö—’Ã∞Å•—ï¥ππï›M—Ö—’Ã∞Å•—ï¥π’Õï…µÖ•∞∞Å•—ï¥ππΩ—î∞Å•—ï¥πç°Öπùïë–§π…’∏†§Ï(ÄÅ…ï—’…∏Å•—ï¥Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å±•Õ—M—Ö—’Õ!•Õ—Ω…‰°ÖùïπçÂ%êËÅÕ—…•πú§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–Å…ïÕ’±–ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅ•ê∞ÅÖùïπçÂ}•êÅLÅÖùïπçÂ%ê∞Å¡…ïŸ•Ω’Õ}Õ—Ö—’ÃÅLÅ¡…ïŸ•Ω’ÕM—Ö—’Ã∞(ÄÄÄÅπï›}Õ—Ö—’ÃÅLÅπï›M—Ö—’Ã∞Å’Õï…}ïµÖ•∞ÅLÅ’Õï…µÖ•∞∞ÅπΩ—î∞Åç°Öπùïë}Ö–ÅLÅç°Öπùïë–(ÄÄÄÅI=4ÅÖùïπçÂ}Õ—Ö—’Õ}°•Õ—Ω…‰Å]!IÅÖùïπçÂ}•êÄÙÄ¸Å=IHÅ	dÅç°Öπùïë}Ö–ÅMÄ§πâ•πê°ÖùïπçÂ%ê§πÖ±∞ÒM—Ö—’Õ!•Õ—Ω…ÂIïçΩ…ê¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃÏ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å±•Õ—QÖÕ≠Ã†§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–Å…ïÕ’±–ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅ–π•ê∞Å–πÖùïπçÂ}•êÅLÅÖùïπçÂ%ê∞Å–π—•—±î∞Å–πëïÕç…•¡—•Ω∏∞(ÄÄÄÅ–πÖÕÕ•ùπïë}—ºÅLÅÖÕÕ•ùπïëQº∞Å–πë’ï}Ö–ÅLÅë’ï–∞Å–π¡…•Ω…•—‰∞Å–πÕ—Ö—’Ã∞Å–πÖç—•Ÿ•—Â}—Â¡îÅLÅÖç—•Ÿ•—ÂQÂ¡î∞(ÄÄÄÅ–ππΩ—ïÃ∞Å–πçΩµ¡±ï—ïë}Ö–ÅLÅçΩµ¡±ï—ïë–∞Å–πç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞Å–πç…ïÖ—ïë}â‰ÅLÅç…ïÖ—ïë	‰∞(ÄÄÄÅÑπ—…Öëï}πÖµîÅLÅÖùïπçÂ9Öµî∞ÅÑπç•—‰ÅLÅÖùïπçÂ•—‰(ÄÄÄÅI=4Å—ÖÕ≠ÃÅ–Å)=%8ÅÖùïπç•ïÃÅÑÅ=8ÅÑπ•êÄÙÅ–πÖùïπçÂ}•êÅ=IHÅ	dÅ–πë’ï}Ö–ÅMÄ§πÖ±∞ÒQÖÕ≠IïçΩ…ê¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃÏ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÖëëQÖÕ¨°—ÖÕ¨ËÅQÖÕ≠IïçΩ…ê§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<Å—ÖÕ≠ÃÄ°•ê∞ÅÖùïπçÂ}•ê∞Å—•—±î∞ÅëïÕç…•¡—•Ω∏∞ÅÖÕÕ•ùπïë}—º∞Åë’ï}Ö–∞Å¡…•Ω…•—‰∞ÅÕ—Ö—’Ã∞(ÄÄÄÅÖç—•Ÿ•—Â}—Â¡î∞ÅπΩ—ïÃ∞ÅçΩµ¡±ï—ïë}Ö–∞Åç…ïÖ—ïë}Ö–∞Åç…ïÖ—ïë}â‰§ÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸•Ä§(ÄÄÄÄπâ•πê°—ÖÕ¨π•ê∞Å—ÖÕ¨πÖùïπçÂ%ê∞Å—ÖÕ¨π—•—±î∞Å—ÖÕ¨πëïÕç…•¡—•Ω∏∞Å—ÖÕ¨πÖÕÕ•ùπïëQº∞Å—ÖÕ¨πë’ï–∞Å—ÖÕ¨π¡…•Ω…•—‰∞Å—ÖÕ¨πÕ—Ö—’Ã∞(ÄÄÄÄÄÅ—ÖÕ¨πÖç—•Ÿ•—ÂQÂ¡î∞Å—ÖÕ¨ππΩ—ïÃ∞Å—ÖÕ¨πçΩµ¡±ï—ïë–∞Å—ÖÕ¨πç…ïÖ—ïë–∞Å—ÖÕ¨πç…ïÖ—ïë	‰§π…’∏†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î†âUAQÅÖùïπç•ïÃÅMPÅπï·—}ôΩ±±Ω›}’¡}Ö–Ù¸Å]!IÅ•êÙ¸à§πâ•πê°—ÖÕ¨πë’ï–∞Å—ÖÕ¨πÖùïπçÂ%ê§π…’∏†§Ï(ÄÅ…ï—’…∏Å—ÖÕ¨Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å’¡ëÖ—ïQÖÕ¨°•êËÅÕ—…•πú∞ÅÕ—Ö—’ÃËÅQÖÕ≠IïçΩ…ëlâÕ—Ö—’Ãât∞ÅçΩµ¡±ï—ïë–ËÅÕ—…•πúÅÅπ’±∞§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î†âUAQÅ—ÖÕ≠ÃÅMPÅÕ—Ö—’ÃÙ¸∞ÅçΩµ¡±ï—ïë}Ö–Ù¸Å]!IÅ•êÙ¸à§πâ•πê°Õ—Ö—’Ã∞ÅçΩµ¡±ï—ïë–∞Å•ê§π…’∏†§Ï(ÄÅ…ï—’…∏ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î†âM1PÅ–π•ê∞Å–πÖùïπçÂ}•êÅLÅÖùïπçÂ%ê∞Å–π—•—±î∞Å–πëïÕç…•¡—•Ω∏∞Å–πÖÕÕ•ùπïë}—ºÅLÅÖÕÕ•ùπïëQº∞Å–πë’ï}Ö–ÅLÅë’ï–∞Å–π¡…•Ω…•—‰∞Å–πÕ—Ö—’Ã∞Å–πÖç—•Ÿ•—Â}—Â¡îÅLÅÖç—•Ÿ•—ÂQÂ¡î∞Å–ππΩ—ïÃ∞Å–πçΩµ¡±ï—ïë}Ö–ÅLÅçΩµ¡±ï—ïë–∞Å–πç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞Å–πç…ïÖ—ïë}â‰ÅLÅç…ïÖ—ïë	‰∞ÅÑπ—…Öëï}πÖµîÅLÅÖùïπçÂ9Öµî∞ÅÑπç•—‰ÅLÅÖùïπçÂ•—‰ÅI=4Å—ÖÕ≠ÃÅ–Å)=%8ÅÖùïπç•ïÃÅÑÅ=8ÅÑπ•êı–πÖùïπçÂ}•êÅ]!IÅ–π•êÙ¸à§πâ•πê°•ê§πô•…Õ–ÒQÖÕ≠IïçΩ…ê¯†§Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Åùï—Ωµµï…ç•Ö±M’µµÖ…‰†§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–ÅmçΩπ—Öç—Ã∞Å—ÖÕ≠ÕtÄÙÅÖ›Ö•–ÅA…Ωµ•ÕîπÖ±∞°m±•Õ—±±Ωπ—Öç—Ã†§∞Å±•Õ—QÖÕ≠Ã†•t§Ï(ÄÅ…ï—’…∏ÅÏÅçΩπ—Öç—Ã∞Å—ÖÕ≠ÃÅÙÏ)Ù()ï·¡Ω…–Å—Â¡îÅ•—°’âMïÕÕ•ΩπIïçΩ…êÄÙÅÏ(ÄÅÕïÕÕ•Ωπ%êËÅÕ—…•πúÏ(ÄÅù•—°’â%êËÅÕ—…•πúÏ(ÄÅ±Ωù•∏ËÅÕ—…•πúÏ(ÄÅë•Õ¡±ÖÂ9ÖµîËÅÕ—…•πúÏ(ÄÅïµÖ•∞ËÅÕ—…•πúÅÅπ’±∞Ï(ÄÅÖŸÖ—Ö…U…∞ËÅÕ—…•πúÅÅπ’±∞Ï(ÄÅç…ïÖ—ïë–ËÅÕ—…•πúÏ(ÄÅï·¡•…ïÕ–ËÅÕ—…•πúÏ)ÙÏ()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÕÖŸï•—°’âMïÕÕ•Ω∏°ÕïÕÕ•Ω∏ËÅ•—°’âMïÕÕ•ΩπIïçΩ…ê§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<Åù•—°’â}ÕïÕÕ•ΩπÃ(ÄÄÄÄ°ÕïÕÕ•Ωπ}•ê∞Åù•—°’â}•ê∞Å±Ωù•∏∞Åë•Õ¡±ÖÂ}πÖµî∞ÅïµÖ•∞∞ÅÖŸÖ—Ö…}’…∞∞Åç…ïÖ—ïë}Ö–∞Åï·¡•…ïÕ}Ö–§(ÄÄÄÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸§(ÄÄÄÅ=8Å=91%P°ÕïÕÕ•Ωπ}•ê§Å<ÅUAQÅMPÅù•—°’â}•êıï·ç±’ëïêπù•—°’â}•ê∞Å±Ωù•∏ıï·ç±’ëïêπ±Ωù•∏∞(ÄÄÄÅë•Õ¡±ÖÂ}πÖµîıï·ç±’ëïêπë•Õ¡±ÖÂ}πÖµî∞ÅïµÖ•∞ıï·ç±’ëïêπïµÖ•∞∞ÅÖŸÖ—Ö…}’…∞ıï·ç±’ëïêπÖŸÖ—Ö…}’…∞∞(ÄÄÄÅç…ïÖ—ïë}Ö–ıï·ç±’ëïêπç…ïÖ—ïë}Ö–∞Åï·¡•…ïÕ}Ö–ıï·ç±’ëïêπï·¡•…ïÕ}Ö—Ä§(ÄÄÄÄπâ•πê°ÕïÕÕ•Ω∏πÕïÕÕ•Ωπ%ê∞ÅÕïÕÕ•Ω∏πù•—°’â%ê∞ÅÕïÕÕ•Ω∏π±Ωù•∏∞ÅÕïÕÕ•Ω∏πë•Õ¡±ÖÂ9Öµî∞ÅÕïÕÕ•Ω∏πïµÖ•∞∞ÅÕïÕÕ•Ω∏πÖŸÖ—Ö…U…∞∞ÅÕïÕÕ•Ω∏πç…ïÖ—ïë–∞ÅÕïÕÕ•Ω∏πï·¡•…ïÕ–§π…’∏†§Ï(ÄÅ…ï—’…∏ÅÕïÕÕ•Ω∏Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Åùï—•—°’âMïÕÕ•Ω∏°ÕïÕÕ•Ωπ%êËÅÕ—…•πú§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–Å…Ω‹ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅÕïÕÕ•Ωπ}•êÅLÅÕïÕÕ•Ωπ%ê∞Åù•—°’â}•êÅLÅù•—°’â%ê∞(ÄÄÄÅ±Ωù•∏∞Åë•Õ¡±ÖÂ}πÖµîÅLÅë•Õ¡±ÖÂ9Öµî∞ÅïµÖ•∞∞ÅÖŸÖ—Ö…}’…∞ÅLÅÖŸÖ—Ö…U…∞∞(ÄÄÄÅç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞Åï·¡•…ïÕ}Ö–ÅLÅï·¡•…ïÕ–ÅI=4Åù•—°’â}ÕïÕÕ•ΩπÃÅ]!IÅÕïÕÕ•Ωπ}•êÄÙÄ˝Ä§(ÄÄÄÄπâ•πê°ÕïÕÕ•Ωπ%ê§πô•…Õ–Ò•—°’âMïÕÕ•ΩπIïçΩ…ê¯†§Ï(ÄÅ•òÄ†Ö…Ω‹§Å…ï—’…∏Åπ’±∞Ï(ÄÅ•òÄ°πï‹ÅÖ—î°…Ω‹πï·¡•…ïÕ–§πùï—Q•µî†§ÄÙÅÖ—îππΩ‹†§§ÅÏ(ÄÄÄÅÖ›Ö•–Åëï±ï—ï•—°’âMïÕÕ•Ω∏°ÕïÕÕ•Ωπ%ê§Ï(ÄÄÄÅ…ï—’…∏Åπ’±∞Ï(ÄÅÙ(ÄÅ…ï—’…∏Å…Ω‹Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Åëï±ï—ï•—°’âMïÕÕ•Ω∏°ÕïÕÕ•Ωπ%êËÅÕ—…•πú§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î†â1QÅI=4Åù•—°’â}ÕïÕÕ•ΩπÃÅ]!IÅÕïÕÕ•Ωπ}•êÄÙÄ¸à§πâ•πê°ÕïÕÕ•Ωπ%ê§π…’∏†§Ï)Ù()ô’πç—•Ω∏Å¡Ö…ÕïM—…•πù1•Õ–°ŸÖ±’îËÅ’π≠πΩ›∏§ËÅÕ—…•πùmtÅÏ(ÄÅ—…‰ÅÏ(ÄÄÄÅçΩπÕ–Å¡Ö…ÕïêÄÙÅ)M=8π¡Ö…Õî°M—…•πú°ŸÖ±’îÄ¸¸Äâmtà§§Ï(ÄÄÄÅ…ï—’…∏Å……Ö‰π•Õ……Ö‰°¡Ö…Õïê§Ä¸Å¡Ö…ÕïêπµÖ¿°M—…•πú§ÄËÅmtÏ(ÄÅÙÅçÖ—ç†ÅÏ(ÄÄÄÅ…ï—’…∏ÅmtÏ(ÄÅÙ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÖëë1ïÖê°±ïÖêËÅ1ïÖëIïçΩ…ê§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<Å±ïÖëÃÄ†(ÄÄÄÅ•ê∞ÅπÖµî∞Å›°Ö—ÕÖ¡¿∞ÅïµÖ•∞∞Åç•—‰∞ÅëïÕ—•πÖ—•Ω∏∞Åï·ç°Öπùï}—Â¡î∞Åâ’ëùï—}…Öπùî∞Å—…ÖŸï±}ëÖ—î∞(ÄÄÄÅë’…Ö—•Ω∏∞Å—…ÖŸï±ï…}Öùî∞ÅπΩ—ïÃ∞ÅçΩπÕïπ–∞ÅÕΩ’…çî∞ÅÕ—Ö—’Ã∞ÅÖÕÕ•ùπïë}—º∞ÅµÖ—ç°ïë}ÖùïπçÂ}•ëÃ∞Åç…ïÖ—ïë}Ö–∞Å’¡ëÖ—ïë}Ö–(ÄÄ§ÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸•Ä§(ÄÄÄÄπâ•πê°±ïÖêπ•ê∞Å±ïÖêππÖµî∞Å±ïÖêπ›°Ö—ÕÖ¡¿∞Å±ïÖêπïµÖ•∞∞Å±ïÖêπç•—‰∞Å±ïÖêπëïÕ—•πÖ—•Ω∏∞Å±ïÖêπï·ç°ÖπùïQÂ¡î∞(ÄÄÄÄÄÅ±ïÖêπâ’ëùï—IÖπùî∞Å±ïÖêπ—…ÖŸï±Ö—î∞Å±ïÖêπë’…Ö—•Ω∏∞Å±ïÖêπ—…ÖŸï±ï…ùî∞Å±ïÖêππΩ—ïÃ∞Å±ïÖêπçΩπÕïπ–Ä¸ÄƒÄËÄ¿∞(ÄÄÄÄÄÅ±ïÖêπÕΩ’…çî∞Å±ïÖêπÕ—Ö—’Ã∞Å±ïÖêπÖÕÕ•ùπïëQº∞Å)M=8πÕ—…•πù•ô‰°±ïÖêπµÖ—ç°ïëùïπçÂ%ëÃ§∞Å±ïÖêπç…ïÖ—ïë–∞Å±ïÖêπ’¡ëÖ—ïë–§π…’∏†§Ï(ÄÅ…ï—’…∏Å±ïÖêÏ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å±•Õ—1ïÖëÃ†§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–Å…ïÕ’±–ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅ•ê∞ÅπÖµî∞Å›°Ö—ÕÖ¡¿∞ÅïµÖ•∞∞Åç•—‰∞ÅëïÕ—•πÖ—•Ω∏∞(ÄÄÄÅï·ç°Öπùï}—Â¡îÅLÅï·ç°ÖπùïQÂ¡î∞Åâ’ëùï—}…ÖπùîÅLÅâ’ëùï—IÖπùî∞Å—…ÖŸï±}ëÖ—îÅLÅ—…ÖŸï±Ö—î∞(ÄÄÄÅë’…Ö—•Ω∏∞Å—…ÖŸï±ï…}ÖùîÅLÅ—…ÖŸï±ï…ùî∞ÅπΩ—ïÃ∞ÅçΩπÕïπ–∞ÅÕΩ’…çî∞ÅÕ—Ö—’Ã∞ÅÖÕÕ•ùπïë}—ºÅLÅÖÕÕ•ùπïëQº∞(ÄÄÄÅµÖ—ç°ïë}ÖùïπçÂ}•ëÃÅLÅµÖ—ç°ïëùïπçÂ%ëÃ∞Åç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞Å’¡ëÖ—ïë}Ö–ÅLÅ’¡ëÖ—ïë–(ÄÄÄÅI=4Å±ïÖëÃÅ=IHÅ	dÅç…ïÖ—ïë}Ö–ÅMÄ§πÖ±∞ÒIïçΩ…êÒÕ—…•πú∞Å’π≠πΩ›∏¯¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃπµÖ¿†°…Ω‹§ÄÙ¯Ä°Ï(ÄÄÄÄ∏∏π…Ω‹∞(ÄÄÄÅçΩπÕïπ–ËÅ	ΩΩ±ïÖ∏°…Ω‹πçΩπÕïπ–§∞(ÄÄÄÅ—…ÖŸï±ï…ùîËÅ…Ω‹π—…ÖŸï±ï…ùîÄÙÙÅπ’±∞Ä¸Åπ’±∞ÄËÅ9’µâï»°…Ω‹π—…ÖŸï±ï…ùî§∞(ÄÄÄÅµÖ—ç°ïëùïπçÂ%ëÃËÅ¡Ö…ÕïM—…•πù1•Õ–°…Ω‹πµÖ—ç°ïëùïπçÂ%ëÃ§∞(ÄÅÙ§§ÅÖÃÅ1ïÖëIïçΩ…ëmtÏ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å’¡ëÖ—ï1ïÖê°•êËÅÕ—…•πú∞Åô•ï±ëÃËÅA•ç¨Ò1ïÖëIïçΩ…ê∞ÄâÕ—Ö—’ÃàÅÄâÖÕÕ•ùπïëQºà¯§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–ÅπΩ‹ÄÙÅπï‹ÅÖ—î†§π—Ω%M=M—…•πú†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î†âUAQÅ±ïÖëÃÅMPÅÕ—Ö—’ÃÙ¸∞ÅÖÕÕ•ùπïë}—ºÙ¸∞Å’¡ëÖ—ïë}Ö–Ù¸Å]!IÅ•êÙ¸à§(ÄÄÄÄπâ•πê°ô•ï±ëÃπÕ—Ö—’Ã∞Åô•ï±ëÃπÖÕÕ•ùπïëQº∞ÅπΩ‹∞Å•ê§π…’∏†§Ï(ÄÅçΩπÕ–Å…Ω›ÃÄÙÅÖ›Ö•–Å±•Õ—1ïÖëÃ†§Ï(ÄÅ…ï—’…∏Å…Ω›Ãπô•πê†°…Ω‹§ÄÙ¯Å…Ω‹π•êÄÙÙÙÅ•ê§Ä¸¸Åπ’±∞Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å±•Õ—5ïÕÕÖùïQïµ¡±Ö—ïÃ°•πç±’ëï%πÖç—•ŸîÄÙÅôÖ±Õî§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–Å…ïÕ’±–ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅ•ê∞ÅπÖµî∞ÅçÖ—ïùΩ…‰∞ÅâΩë‰∞ÅÖç—•Ÿî∞(ÄÄÄÅç…ïÖ—ïë}â‰ÅLÅç…ïÖ—ïë	‰∞Åç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞Å’¡ëÖ—ïë}Ö–ÅLÅ’¡ëÖ—ïë–(ÄÄÄÅI=4ÅµïÕÕÖùï}—ïµ¡±Ö—ïÃÄëÌ•πç±’ëï%πÖç—•ŸîÄ¸ÄààÄËÄâ]!IÅÖç—•ŸîÄÙÄƒâÙÅ=IHÅ	dÅçÖ—ïùΩ…‰∞ÅπÖµïÄ§πÖ±∞Ò=µ•–Ò5ïÕÕÖùïQïµ¡±Ö—î∞ÄâÖç—•Ÿîà¯ÄòÅÏÅÖç—•ŸîËÅπ’µâï»ÅÙ¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃπµÖ¿†°…Ω‹§ÄÙ¯Ä°ÏÄ∏∏π…Ω‹∞ÅÖç—•ŸîËÅ	ΩΩ±ïÖ∏°…Ω‹πÖç—•Ÿî§ÅÙ§§Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÕÖŸï5ïÕÕÖùïQïµ¡±Ö—î°—ïµ¡±Ö—îËÅ5ïÕÕÖùïQïµ¡±Ö—î§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<ÅµïÕÕÖùï}—ïµ¡±Ö—ïÃÄ°•ê∞ÅπÖµî∞ÅçÖ—ïùΩ…‰∞ÅâΩë‰∞ÅÖç—•Ÿî∞Åç…ïÖ—ïë}â‰∞Åç…ïÖ—ïë}Ö–∞Å’¡ëÖ—ïë}Ö–§(ÄÄÄÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸§(ÄÄÄÅ=8Å=91%P°•ê§Å<ÅUAQÅMPÅπÖµîıï·ç±’ëïêππÖµî∞ÅçÖ—ïùΩ…‰ıï·ç±’ëïêπçÖ—ïùΩ…‰∞ÅâΩë‰ıï·ç±’ëïêπâΩë‰∞(ÄÄÄÅÖç—•Ÿîıï·ç±’ëïêπÖç—•Ÿî∞Å’¡ëÖ—ïë}Ö–ıï·ç±’ëïêπ’¡ëÖ—ïë}Ö—Ä§πâ•πê†(ÄÄÄÄÄÅ—ïµ¡±Ö—îπ•ê∞Å—ïµ¡±Ö—îππÖµî∞Å—ïµ¡±Ö—îπçÖ—ïùΩ…‰∞Å—ïµ¡±Ö—îπâΩë‰∞Å—ïµ¡±Ö—îπÖç—•ŸîÄ¸ÄƒÄËÄ¿∞(ÄÄÄÄÄÅ—ïµ¡±Ö—îπç…ïÖ—ïë	‰∞Å—ïµ¡±Ö—îπç…ïÖ—ïë–∞Å—ïµ¡±Ö—îπ’¡ëÖ—ïë–§π…’∏†§Ï(ÄÅçΩπÕ–Å…Ω›ÃÄÙÅÖ›Ö•–Å±•Õ—5ïÕÕÖùïQïµ¡±Ö—ïÃ°—…’î§Ï(ÄÅ…ï—’…∏Å…Ω›Ãπô•πê†°…Ω‹§ÄÙ¯Å…Ω‹π•êÄÙÙÙÅ—ïµ¡±Ö—îπ•ê§Ä¸¸Åπ’±∞Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Åëï±ï—ï5ïÕÕÖùïQïµ¡±Ö—î°•êËÅÕ—…•πú§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î†â1QÅI=4ÅµïÕÕÖùï}—ïµ¡±Ö—ïÃÅ]!IÅ•êÙ¸à§πâ•πê°•ê§π…’∏†§Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Åùï—UÕï…IΩ±î°’Õï…-ï‰ËÅÕ—…•πú§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅ…ï—’…∏ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅ’Õï…}≠ï‰ÅLÅ’Õï…-ï‰∞Å±Ωù•∏∞ÅïµÖ•∞∞Åë•Õ¡±ÖÂ}πÖµîÅLÅë•Õ¡±ÖÂ9Öµî∞(ÄÄÄÅ…Ω±î∞ÅÖç—•Ÿî∞Åç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞Å’¡ëÖ—ïë}Ö–ÅLÅ’¡ëÖ—ïë–ÅI=4Å’Õï…}…Ω±ïÃÅ]!IÅ’Õï…}≠ï‰Ù˝Ä§πâ•πê°’Õï…-ï‰§πô•…Õ–Ò=µ•–ÒUÕï…IΩ±ïIïçΩ…ê∞ÄâÖç—•Ÿîà¯ÄòÅÏÅÖç—•ŸîËÅπ’µâï»ÅÙ¯†§Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å±•Õ—UÕï…IΩ±ïÃ†§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–Å…ïÕ’±–ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅ’Õï…}≠ï‰ÅLÅ’Õï…-ï‰∞Å±Ωù•∏∞ÅïµÖ•∞∞Åë•Õ¡±ÖÂ}πÖµîÅLÅë•Õ¡±ÖÂ9Öµî∞(ÄÄÄÅ…Ω±î∞ÅÖç—•Ÿî∞Åç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞Å’¡ëÖ—ïë}Ö–ÅLÅ’¡ëÖ—ïë–ÅI=4Å’Õï…}…Ω±ïÃÅ=IHÅ	dÅë•Õ¡±ÖÂ}πÖµïÄ§πÖ±∞Ò=µ•–ÒUÕï…IΩ±ïIïçΩ…ê∞ÄâÖç—•Ÿîà¯ÄòÅÏÅÖç—•ŸîËÅπ’µâï»ÅÙ¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃπµÖ¿†°…Ω‹§ÄÙ¯Ä°ÏÄ∏∏π…Ω‹∞ÅÖç—•ŸîËÅ	ΩΩ±ïÖ∏°…Ω‹πÖç—•Ÿî§ÅÙ§§Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÕÖŸïUÕï…IΩ±î°…ïçΩ…êËÅUÕï…IΩ±ïIïçΩ…ê§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<Å’Õï…}…Ω±ïÃÄ°’Õï…}≠ï‰∞Å±Ωù•∏∞ÅïµÖ•∞∞Åë•Õ¡±ÖÂ}πÖµî∞Å…Ω±î∞ÅÖç—•Ÿî∞Åç…ïÖ—ïë}Ö–∞Å’¡ëÖ—ïë}Ö–§(ÄÄÄÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸§(ÄÄÄÅ=8Å=91%P°’Õï…}≠ï‰§Å<ÅUAQÅMPÅ±Ωù•∏ıï·ç±’ëïêπ±Ωù•∏∞ÅïµÖ•∞ıï·ç±’ëïêπïµÖ•∞∞(ÄÄÄÅë•Õ¡±ÖÂ}πÖµîıï·ç±’ëïêπë•Õ¡±ÖÂ}πÖµî∞Å…Ω±îıï·ç±’ëïêπ…Ω±î∞ÅÖç—•Ÿîıï·ç±’ëïêπÖç—•Ÿî∞Å’¡ëÖ—ïë}Ö–ıï·ç±’ëïêπ’¡ëÖ—ïë}Ö—Ä§πâ•πê†(ÄÄÄÄÄÅ…ïçΩ…êπ’Õï…-ï‰∞Å…ïçΩ…êπ±Ωù•∏∞Å…ïçΩ…êπïµÖ•∞∞Å…ïçΩ…êπë•Õ¡±ÖÂ9Öµî∞Å…ïçΩ…êπ…Ω±î∞Å…ïçΩ…êπÖç—•ŸîÄ¸ÄƒÄËÄ¿∞(ÄÄÄÄÄÅ…ïçΩ…êπç…ïÖ—ïë–∞Å…ïçΩ…êπ’¡ëÖ—ïë–§π…’∏†§Ï(ÄÅçΩπÕ–ÅÕÖŸïêÄÙÅÖ›Ö•–Åùï—UÕï…IΩ±î°…ïçΩ…êπ’Õï…-ï‰§Ï(ÄÅ…ï—’…∏ÅÕÖŸïêÄ¸ÅÏÄ∏∏πÕÖŸïê∞ÅÖç—•ŸîËÅ	ΩΩ±ïÖ∏°ÕÖŸïêπÖç—•Ÿî§ÅÙÄËÅπ’±∞Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÖëëπÖ±Â—•çÕŸïπ–°ïŸïπ–ËÅπÖ±Â—•çÕŸïπ—IïçΩ…ê§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<ÅÖπÖ±Â—•çÕ}ïŸïπ—ÃÄ°•ê∞ÅπÖµî∞Å¡Ö—†∞ÅÖùïπçÂ}•ê∞Å’Õï…}ïµÖ•∞∞Åµï—ÖëÖ—Ñ∞Åç…ïÖ—ïë}Ö–§(ÄÄÄÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸•Ä§πâ•πê°ïŸïπ–π•ê∞ÅïŸïπ–ππÖµî∞ÅïŸïπ–π¡Ö—†∞ÅïŸïπ–πÖùïπçÂ%ê∞ÅïŸïπ–π’Õï…µÖ•∞∞(ÄÄÄÄÄÅ)M=8πÕ—…•πù•ô‰°ïŸïπ–πµï—ÖëÖ—ÑÄ¸¸ÅÌÙ§∞ÅïŸïπ–πç…ïÖ—ïë–§π…’∏†§Ï(ÄÅ…ï—’…∏ÅïŸïπ–Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÕ’µµÖ…•ÈïπÖ±Â—•çÃ°ëÖÂÃÄÙÄÃ¿§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–ÅÕ•πçîÄÙÅπï‹ÅÖ—î°Ö—îππΩ‹†§Ä¥ÅëÖÂÃÄ®Ä‡ÿ–¿¿¿¿¿§π—Ω%M=M—…•πú†§Ï(ÄÅçΩπÕ–Å…ïÕ’±–ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅπÖµî∞Å=U9P†®§ÅLÅŸÖ±’îÅI=4ÅÖπÖ±Â—•çÕ}ïŸïπ—ÃÅ]!IÅç…ïÖ—ïë}Ö–Ä¯ÙÄ¸ÅI=U@Å	dÅπÖµîÅ=IHÅ	dÅŸÖ±’îÅMÄ§πâ•πê°Õ•πçî§πÖ±∞ÒÏÅπÖµîËÅÕ—…•πúÏÅŸÖ±’îËÅπ’µâï»ÅÙ¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃπµÖ¿†°…Ω‹§ÄÙ¯Ä°ÏÅ±Öâï∞ËÅ…Ω‹ππÖµî∞ÅŸÖ±’îËÅ9’µâï»°…Ω‹πŸÖ±’î§ÅÙ§§Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å±•Õ—ùïπçÂA±ÖπÃ°•πç±’ëï%πÖç—•ŸîÄÙÅôÖ±Õî§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–Å…ïÕ’±–ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅ•ê∞ÅçΩëî∞ÅπÖµî∞ÅëïÕç…•¡—•Ω∏∞ÅµΩπ—°±Â}¡…•çîÅLÅµΩπ—°±ÂA…•çî∞ÅôïÖ—’…ïÃ∞ÅÖç—•Ÿî∞(ÄÄÄÅç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞Å’¡ëÖ—ïë}Ö–ÅLÅ’¡ëÖ—ïë–ÅI=4ÅÖùïπçÂ}¡±ÖπÃÄëÌ•πç±’ëï%πÖç—•ŸîÄ¸ÄààÄËÄâ]!IÅÖç—•ŸîÄÙÄƒâÙÅ=IHÅ	dÅ•ëÄ§πÖ±∞ÒIïçΩ…êÒÕ—…•πú∞Å’π≠πΩ›∏¯¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃπµÖ¿†°…Ω‹§ÄÙ¯Ä°ÏÄ∏∏π…Ω‹∞ÅµΩπ—°±ÂA…•çîËÅ…Ω‹πµΩπ—°±ÂA…•çîÄÙÙÅπ’±∞Ä¸Åπ’±∞ÄËÅ9’µâï»°…Ω‹πµΩπ—°±ÂA…•çî§∞ÅôïÖ—’…ïÃËÅ¡Ö…ÕïM—…•πù1•Õ–°…Ω‹πôïÖ—’…ïÃ§∞ÅÖç—•ŸîËÅ	ΩΩ±ïÖ∏°…Ω‹πÖç—•Ÿî§ÅÙ§§ÅÖÃÅùïπçÂA±ÖπmtÏ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÕÖŸïùïπçÂA±Ö∏°¡±Ö∏ËÅùïπçÂA±Ö∏§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<ÅÖùïπçÂ}¡±ÖπÃÄ°•ê∞ÅçΩëî∞ÅπÖµî∞ÅëïÕç…•¡—•Ω∏∞ÅµΩπ—°±Â}¡…•çî∞ÅôïÖ—’…ïÃ∞ÅÖç—•Ÿî∞Åç…ïÖ—ïë}Ö–∞Å’¡ëÖ—ïë}Ö–§(ÄÄÄÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸§Å=8Å=91%P°•ê§Å<ÅUAQÅMPÅçΩëîıï·ç±’ëïêπçΩëî∞ÅπÖµîıï·ç±’ëïêππÖµî∞(ÄÄÄÅëïÕç…•¡—•Ω∏ıï·ç±’ëïêπëïÕç…•¡—•Ω∏∞ÅµΩπ—°±Â}¡…•çîıï·ç±’ëïêπµΩπ—°±Â}¡…•çî∞ÅôïÖ—’…ïÃıï·ç±’ëïêπôïÖ—’…ïÃ∞ÅÖç—•Ÿîıï·ç±’ëïêπÖç—•Ÿî∞Å’¡ëÖ—ïë}Ö–ıï·ç±’ëïêπ’¡ëÖ—ïë}Ö—Ä§(ÄÄÄÄπâ•πê°¡±Ö∏π•ê∞Å¡±Ö∏πçΩëî∞Å¡±Ö∏ππÖµî∞Å¡±Ö∏πëïÕç…•¡—•Ω∏∞Å¡±Ö∏πµΩπ—°±ÂA…•çî∞Å)M=8πÕ—…•πù•ô‰°¡±Ö∏πôïÖ—’…ïÃ§∞Å¡±Ö∏πÖç—•ŸîÄ¸ÄƒÄËÄ¿∞Å¡±Ö∏πç…ïÖ—ïë–∞Å¡±Ö∏π’¡ëÖ—ïë–§π…’∏†§Ï(ÄÅ…ï—’…∏Ä°Ö›Ö•–Å±•Õ—ùïπçÂA±ÖπÃ°—…’î§§πô•πê†°•—ï¥§ÄÙ¯Å•—ï¥π•êÄÙÙÙÅ¡±Ö∏π•ê§Ä¸¸Åπ’±∞Ï)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏Å±•Õ—ùïπçÂM’âÕç…•¡—•ΩπÃ†§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅçΩπÕ–Å…ïÕ’±–ÄÙÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°ÅM1PÅÃπ•ê∞ÅÃπÖùïπçÂ}•êÅLÅÖùïπçÂ%ê∞ÅÃπ¡±Öπ}•êÅLÅ¡±Öπ%ê∞ÅÃπÕ—Ö—’Ã∞(ÄÄÄÅÃπÕ—Ö…—ïë}Ö–ÅLÅÕ—Ö…—ïë–∞ÅÃπïπëÕ}Ö–ÅLÅïπëÕ–∞ÅÃπï·—ï…πÖ±}ç’Õ—Ωµï…}•êÅLÅï·—ï…πÖ±’Õ—Ωµï…%ê∞(ÄÄÄÅÃπç…ïÖ—ïë}Ö–ÅLÅç…ïÖ—ïë–∞ÅÃπ’¡ëÖ—ïë}Ö–ÅLÅ’¡ëÖ—ïë–∞ÅÑπ—…Öëï}πÖµîÅLÅÖùïπçÂ9Öµî∞Å¿ππÖµîÅLÅ¡±Öπ9Öµî(ÄÄÄÅI=4ÅÖùïπçÂ}Õ’âÕç…•¡—•ΩπÃÅÃÅ)=%8ÅÖùïπç•ïÃÅÑÅ=8ÅÑπ•êıÃπÖùïπçÂ}•êÅ)=%8ÅÖùïπçÂ}¡±ÖπÃÅ¿Å=8Å¿π•êıÃπ¡±Öπ}•êÅ=IHÅ	dÅÃπ’¡ëÖ—ïë}Ö–ÅMÄ§πÖ±∞ÒùïπçÂM’âÕç…•¡—•Ω∏¯†§Ï(ÄÅ…ï—’…∏Å…ïÕ’±–π…ïÕ’±—ÃÏ)Ù()ï·¡Ω…–ÅÖÕÂπåÅô’πç—•Ω∏ÅÕÖŸïùïπçÂM’âÕç…•¡—•Ω∏°Õ’âÕç…•¡—•Ω∏ËÅùïπçÂM’âÕç…•¡—•Ω∏§ÅÏ(ÄÅÖ›Ö•–ÅïπÕ’…ïÖ—ÖâÖÕî†§Ï(ÄÅÖ›Ö•–ÅëÖ—ÖâÖÕî†§π¡…ï¡Ö…î°Å%9MIPÅ%9Q<ÅÖùïπçÂ}Õ’âÕç…•¡—•ΩπÃÄ°•ê∞ÅÖùïπçÂ}•ê∞Å¡±Öπ}•ê∞ÅÕ—Ö—’Ã∞ÅÕ—Ö…—ïë}Ö–∞ÅïπëÕ}Ö–∞Åï·—ï…πÖ±}ç’Õ—Ωµï…}•ê∞Åç…ïÖ—ïë}Ö–∞Å’¡ëÖ—ïë}Ö–§(ÄÄÄÅY1ULÄ†¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸∞Ä¸§Å=8Å=91%P°•ê§Å<ÅUAQÅMPÅ¡±Öπ}•êıï·ç±’ëïêπ¡±Öπ}•ê∞ÅÕ—Ö—’Ãıï·ç±’ëïêπÕ—Ö—’Ã∞(ÄÄÄÅÕ—Ö…—ïë}Ö–ıï·ç±’ëïêπÕ—Ö…—ïë}Ö–∞ÅïπëÕ}Ö–ıï·ç±’ëïêπïπëÕ}Ö–∞Åï·—ï…πÖ±}ç’Õ—Ωµï…}•êıï·ç±’ëïêπï·—ï…πÖ±}ç’Õ—Ωµï…}•ê∞Å’¡ëÖ—ïë}Ö–ıï·ç±’ëïêπ’¡ëÖ—ïë}Ö—Ä§(ÄÄÄÄπâ•πê°Õ’âÕç…•¡—•Ω∏π•ê∞ÅÕ’âÕç…•¡—•Ω∏πÖùïπçÂ%ê∞ÅÕ’âÕç…•¡—•Ω∏π¡±Öπ%ê∞ÅÕ’âÕç…•¡—•Ω∏πÕ—Ö—’Ã∞ÅÕ’âÕç…•¡—•Ω∏πÕ—Ö…—ïë–∞ÅÕ’âÕç…•¡—•Ω∏πïπëÕ–∞ÅÕ’âÕç…•¡—•Ω∏πï·—ï…πÖ±’Õ—Ωµï…%ê∞ÅÕ’âÕç…•¡—•Ω∏πç…ïÖ—ïë–∞ÅÕ’âÕç…•¡—•Ω∏π’¡ëÖ—ïë–§π…’∏†§Ï(ÄÅ…ï—’…∏Ä°Ö›Ö•–Å±•Õ—ùïπçÂM’âÕç…•¡—•ΩπÃ†§§πô•πê†°•—ï¥§ÄÙ¯Å•—ï¥π•êÄÙÙÙÅÕ’âÕç…•¡—•Ω∏π•ê§Ä¸¸Åπ’±∞Ï)Ù