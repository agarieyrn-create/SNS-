CREATE TABLE `aiUsageRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`connectionId` int,
	`provider` enum('openai','anthropic','gemini','openrouter') NOT NULL,
	`action` enum('generate','rewrite') NOT NULL,
	`status` enum('reserved','succeeded','failed') NOT NULL,
	`reservedCostMilliUsd` int NOT NULL,
	`chargedCostMilliUsd` int,
	`inputTokens` int,
	`outputTokens` int,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` datetime,
	CONSTRAINT `aiUsageRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `aiProviderConnections` ADD `monthlyRequestLimit` int DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `aiProviderConnections` ADD `monthlyBudgetMilliUsd` int DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `aiProviderConnections` ADD `perRequestReservationMilliUsd` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `aiUsageRecords` ADD CONSTRAINT `aiUsageRecords_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiUsageRecords` ADD CONSTRAINT `aiUsageRecords_connectionId_aiProviderConnections_id_fk` FOREIGN KEY (`connectionId`) REFERENCES `aiProviderConnections`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_usage_records_user_provider_month_idx` ON `aiUsageRecords` (`userId`,`provider`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_usage_records_connection_month_idx` ON `aiUsageRecords` (`connectionId`,`createdAt`);