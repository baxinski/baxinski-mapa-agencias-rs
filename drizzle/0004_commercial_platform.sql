CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  destination TEXT NOT NULL,
  exchange_type TEXT NOT NULL,
  budget_range TEXT,
  travel_date TEXT,
  duration TEXT,
  traveler_age INTEGER,
  notes TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'public-form',
  status TEXT NOT NULL DEFAULT 'Novo',
  assigned_to TEXT,
  matched_agency_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status, created_at);

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_key TEXT PRIMARY KEY,
  login TEXT,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'consulta',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT,
  agency_id TEXT,
  user_email TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(name, created_at);
