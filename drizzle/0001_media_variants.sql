-- DEFAULT '' requis par SQLite pour ALTER ... NOT NULL ; la table media est vide avant cette migration.
ALTER TABLE `media` ADD `public_key` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `media` ADD `thumb_path` text;--> statement-breakpoint
ALTER TABLE `media` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `media` ADD `height` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `media_public_key_unique` ON `media` (`public_key`);