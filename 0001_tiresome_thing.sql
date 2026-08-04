CREATE TABLE `agency_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`previous_status` text,
	`new_status` text NOT NULL,
	`user_email` text,
	`note` text,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`assigned_to` text,
	`due_at` text NOT NULL,
	`priority` text DEFAULT 'Média' NOT NULL,
	`status` text DEFAULT 'Aberta' NOT NULL,
	`activity_type` text DEFAULT 'Follow-up' NOT NULL,
	`notes` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`created_by` text
);
--> statement-breakpoint
ALTER TABLE `agencies` ADD `state` text DEFAULT 'RS' NOT NULL;--> statement-breakpoint
ALTER TABLE `agencies` ADD `neighborhood` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `whatsapp` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `commercial_status` text DEFAULT 'Não contatada' NOT NULL;--> statement-breakpoint
ALTER TABLE `agencies` ADD `assigned_to` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `opportunity_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agencies` ADD `estimated_value` real;--> statement-breakpoint
ALTER TABLE `agencies` ADD `first_contact_at` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `last_contact_at` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `next_follow_up_at` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `loss_reason` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `google_rating` real;--> statement-breakpoint
ALTER TABLE `agencies` ADD `google_review_count` integer;--> statement-breakpoint
ALTER TABLE `agencies` ADD `is_franchise` integer;--> statement-breakpoint
ALTER TABLE `agencies` ADD `destinations` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `agencies` ADD `exchange_types` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `agencies` ADD `description` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `hours` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `agencies` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `contacts` ADD `interaction_type` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `contact_time` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `result` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `next_contact_at` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `created_by` text;