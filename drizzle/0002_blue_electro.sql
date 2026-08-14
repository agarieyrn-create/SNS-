CREATE TABLE `weeklyReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weekStart` datetime NOT NULL,
	`weekEnd` datetime NOT NULL,
	`source` enum('manual','scheduled') NOT NULL,
	`postCount` int NOT NULL,
	`impressions` int NOT NULL,
	`engagements` int NOT NULL,
	`engagementRateBps` int NOT NULL,
	`impressionChangePct` int,
	`engagementRateChangeBps` int,
	`categoryBreakdown` json NOT NULL,
	`insights` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weeklyReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_reports_user_week_unique` UNIQUE(`userId`,`weekStart`)
);
--> statement-breakpoint
ALTER TABLE `growthSettings` ADD `weeklyReportEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `growthSettings` ADD `weeklyReportCronTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `growthSettings` ADD `weeklyReportLastGeneratedAt` datetime;--> statement-breakpoint
CREATE INDEX `weekly_reports_user_created_idx` ON `weeklyReports` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `growth_settings_weekly_cron_idx` ON `growthSettings` (`weeklyReportCronTaskUid`);