CREATE TABLE `source_item` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`item_guid` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_item_guid_idx` ON `source_item` (`source_id`,`item_guid`);