ALTER TABLE `aiUsageRecords` MODIFY COLUMN `action` enum('generate','rewrite','connection_test') NOT NULL;--> statement-breakpoint
ALTER TABLE `aiProviderConnections` ADD `lastTestedAt` datetime;--> statement-breakpoint
ALTER TABLE `aiProviderConnections` ADD `lastTestError` text;