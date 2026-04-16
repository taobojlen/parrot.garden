ALTER TABLE `post_log` ADD `first_failed_at` integer;--> statement-breakpoint
ALTER TABLE `post_log` ADD `next_retry_at` integer;
