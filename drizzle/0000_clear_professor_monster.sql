CREATE TABLE `agencies` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`legal_name` text,
	`trade_name` text NOT NULL,
	`city` text NOT NULL,
	`region` text NOT NULL,
	`address` text,
	`phone` text,
	`email` text,
	`website` text,
	`instagram` text,
	`linkedin` text,
	`directors` text,
	`owners` text,
	`commercial_manager` text,
	`exchange_lead` text,
	`programs` text DEFAULT '[]' NOT NULL,
	`belta` integer,
	`units` integer DEFAULT 1 NOT NULL,
	`audience_profile` text NOT NULL,
	`commercial_potential` text NOT NULL,
	`notes` text,
	`verification_status` text NOT NULL,
	`source_url` text,
	`source_label` text,
	`verified_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agencies_slug_unique` ON `agencies` (`slug`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`contact_date` text NOT NULL,
	`channel` text NOT NULL,
	`contact_name` text,
	`summary` text NOT NULL,
	`next_step` text,
	`created_at` text NOT NULL
);
