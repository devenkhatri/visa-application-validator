CREATE TABLE `document_extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_hash` text NOT NULL,
	`document_type` text NOT NULL,
	`extracted_data` text NOT NULL,
	`ocr_model` text DEFAULT 'google/gemma-4-26b-it:free',
	`confidence_score` real,
	`is_valid` integer DEFAULT true NOT NULL,
	`extracted_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_extractions_document_hash_unique` ON `document_extractions` (`document_hash`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`document_type` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`document_hash` text NOT NULL,
	`file_data` blob,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_results` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`gap_analysis` text NOT NULL,
	`overall_score` integer,
	`score_breakdown` text,
	`verdict` text,
	`scrubbed_input` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`checklist_id` text NOT NULL,
	`nationality` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`completed_at` text
);
