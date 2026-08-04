CREATE TABLE `github_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`login` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`avatar_url` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
