CREATE TABLE `aiProviderConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('openai','anthropic','gemini','openrouter') NOT NULL,
	`encryptedApiKey` text NOT NULL,
	`encryptionIv` varchar(24) NOT NULL,
	`encryptionTag` varchar(32) NOT NULL,
	`model` varchar(160) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`priority` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiProviderConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_provider_connection_user_provider_unique` UNIQUE(`userId`,`provider`)
);
--> statement-breakpoint
ALTER TABLE `aiProviderConnections` ADD CONSTRAINT `aiProviderConnections_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_provider_connection_user_priority_idx` ON `aiProviderConnections` (`userId`,`priority`);