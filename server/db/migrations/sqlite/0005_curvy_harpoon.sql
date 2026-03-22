CREATE TABLE `mastodon_app` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_url` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mastodon_app_instance_url_unique` ON `mastodon_app` (`instance_url`);--> statement-breakpoint
CREATE TABLE `mastodon_oauth_state` (
	`id` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mastodon_oauth_state_nonce_unique` ON `mastodon_oauth_state` (`nonce`);