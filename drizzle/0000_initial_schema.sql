CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`details` text,
	`ip_hash` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_logs_created_idx` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `activity_logs_entity_idx` ON `activity_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `candles` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`first_name` text,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`ip_hash` text,
	`moderated_by_id` text,
	`moderated_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `deceased_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moderated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `candles_profile_status_idx` ON `candles` (`profile_id`,`status`);--> statement-breakpoint
CREATE INDEX `candles_ip_idx` ON `candles` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `condolence_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`author_name` text NOT NULL,
	`message` text NOT NULL,
	`email` text,
	`phone` text,
	`consent_to_publish` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`ip_hash` text,
	`moderated_by_id` text,
	`moderated_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `deceased_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moderated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `condolences_profile_status_idx` ON `condolence_messages` (`profile_id`,`status`);--> statement-breakpoint
CREATE INDEX `condolences_ip_idx` ON `condolence_messages` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `deceased_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`family_id` text,
	`full_name` text NOT NULL,
	`birth_date` text,
	`death_date` text,
	`biography` text,
	`main_photo_media_id` text,
	`ceremony_date` text,
	`ceremony_time` text,
	`ceremony_location` text,
	`ceremony_address` text,
	`livestream_url` text,
	`practical_info` text,
	`show_dates` integer DEFAULT true NOT NULL,
	`show_biography` integer DEFAULT true NOT NULL,
	`show_ceremony` integer DEFAULT true NOT NULL,
	`show_practical_info` integer DEFAULT true NOT NULL,
	`show_gallery` integer DEFAULT true NOT NULL,
	`allow_condolences` integer DEFAULT true NOT NULL,
	`allow_candles` integer DEFAULT true NOT NULL,
	`internal_notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_by_id` text,
	`updated_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deceased_profiles_public_id_unique` ON `deceased_profiles` (`public_id`);--> statement-breakpoint
CREATE INDEX `deceased_profiles_family_idx` ON `deceased_profiles` (`family_id`);--> statement-breakpoint
CREATE INDEX `deceased_profiles_status_idx` ON `deceased_profiles` (`status`);--> statement-breakpoint
CREATE INDEX `deceased_profiles_name_idx` ON `deceased_profiles` (`full_name`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`contact_phone` text,
	`contact_email` text,
	`address` text,
	`internal_notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_id` text,
	`updated_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `families_name_idx` ON `families` (`name`);--> statement-breakpoint
CREATE INDEX `families_status_idx` ON `families` (`status`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`ip_hash` text,
	`success` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_email_idx` ON `login_attempts` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `login_attempts_ip_idx` ON `login_attempts` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`type` text NOT NULL,
	`storage_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`deleted_at` integer,
	`uploaded_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `deceased_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `media_profile_idx` ON `media` (`profile_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_hash` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);