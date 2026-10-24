CREATE TABLE `beta_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`message` text NOT NULL,
	`category` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connector_credentials` (
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`options_json` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	`verified_at` integer,
	`verification` text DEFAULT 'unverified' NOT NULL,
	PRIMARY KEY(`owner`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `data_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`expected_count` integer NOT NULL,
	`status` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`activated_at` integer
);
--> statement-breakpoint
CREATE TABLE `import_files` (
	`import_id` text NOT NULL,
	`path` text NOT NULL,
	`sha256` text NOT NULL,
	`bytes` integer NOT NULL,
	PRIMARY KEY(`import_id`, `path`)
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`result_json` text
);
--> statement-breakpoint
CREATE INDEX `job_runs_owner_started` ON `job_runs` (`owner`,`started_at`);--> statement-breakpoint
CREATE TABLE `market_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`payload` text NOT NULL,
	`checked_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `market_cache_expiry` ON `market_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expiry` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `user_values` (
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`value_json` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `key`)
);
--> statement-breakpoint
CREATE INDEX `user_values_owner_updated` ON `user_values` (`owner`,`updated_at`);