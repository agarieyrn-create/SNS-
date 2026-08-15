CREATE TABLE `weeklyReportRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskUid` varchar(65),
	`trigger` enum('manual','scheduled','retry') NOT NULL,
	`status` enum('running','succeeded','failed','skipped') NOT NULL,
	`reportId` int,
	`error` text,
	`startedAt` datetime NOT NULL,
	`finishedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weeklyReportRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `weeklyReportRuns` ADD CONSTRAINT `weeklyReportRuns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weeklyReportRuns` ADD CONSTRAINT `weeklyReportRuns_reportId_weeklyReports_id_fk` FOREIGN KEY (`reportId`) REFERENCES `weeklyReports`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `weekly_report_runs_user_started_idx` ON `weeklyReportRuns` (`userId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `weekly_report_runs_task_started_idx` ON `weeklyReportRuns` (`taskUid`,`startedAt`);--> statement-breakpoint
ALTER TABLE `growthSettings` ADD CONSTRAINT `growthSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideas` ADD CONSTRAINT `ideas_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `postDrafts` ADD CONSTRAINT `postDrafts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `postDrafts` ADD CONSTRAINT `postDrafts_ideaId_ideas_id_fk` FOREIGN KEY (`ideaId`) REFERENCES `ideas`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `postResults` ADD CONSTRAINT `postResults_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `postResults` ADD CONSTRAINT `postResults_ideaId_ideas_id_fk` FOREIGN KEY (`ideaId`) REFERENCES `ideas`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `postResults` ADD CONSTRAINT `postResults_draftId_postDrafts_id_fk` FOREIGN KEY (`draftId`) REFERENCES `postDrafts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weeklyReports` ADD CONSTRAINT `weeklyReports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;