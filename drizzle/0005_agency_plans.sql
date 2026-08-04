CREATE TABLE IF NOT EXISTS `agency_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `monthly_price` real,
  `features` text DEFAULT '[]' NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE TABLE IF NOT EXISTS `agency_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `agency_id` text NOT NULL,
  `plan_id` text NOT NULL,
  `status` text DEFAULT 'trial' NOT NULL,
  `started_at` text NOT NULL,
  `ends_at` text,
  `external_customer_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `agency_subscriptions_agency_idx` ON `agency_subscriptions` (`agency_id`,`status`);
