CREATE TABLE `feed_poll_state` (
	`url` text PRIMARY KEY NOT NULL,
	`etag` text,
	`last_modified` text,
	`items` text,
	`failures` integer DEFAULT 0 NOT NULL,
	`next_poll_at` integer
);
