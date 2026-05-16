CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`stage` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`output_summary` text,
	`metadata` text,
	`duration_ms` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checklist_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`base_checklist_id` text NOT NULL,
	`questionnaire_answers` text NOT NULL,
	`generated_checklist` text NOT NULL,
	`profile_flags` text,
	`high_risk_factors` text,
	`strengths` text,
	`special_instructions` text,
	`generated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
