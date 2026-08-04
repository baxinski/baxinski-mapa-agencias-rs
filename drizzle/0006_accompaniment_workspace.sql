ALTER TABLE `agencies` ADD `accompaniment_status` text DEFAULT 'Não analisada' NOT NULL;--> statement-breakpoint
ALTER TABLE `agencies` ADD `accompaniment_priority` text DEFAULT 'Sem prioridade definida' NOT NULL;--> statement-breakpoint
ALTER TABLE `agencies` ADD `primary_contact_name` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `primary_contact_role` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `contact_role` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `information_obtained` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `result` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `visit_order` integer;

