CREATE TABLE `scheduledPostRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scheduledPostId` int NOT NULL,
	`taskUid` varchar(65),
	`trigger` enum('scheduled','retry') NOT NULL,
	`status` enum('running','succeeded','failed','skipped') NOT NULL,
	`xPostId` varchar(64),
	`error` text,
	`startedAt` datetime NOT NULL,
	`finishedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduledPostRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`draftId` int,
	`content` varchar(2000) NOT NULL,
	`scheduledFor` datetime NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Tokyo',
	`status` enum('scheduled','publishing','published','failed','cancelled') NOT NULL DEFAULT 'scheduled',
	`scheduleCronTaskUid` varchar(65),
	`attemptCount` int NOT NULL DEFAULT 0,
	`xPostId` varchar(64),
	`postedAt` datetime,
	`lastAttemptAt` datetime,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduledPosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `xAccountConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`encryptedApiKey` text NOT NULL,
	`apiKeyIv` varchar(24) NOT NULL,
	`apiKeyTag` varchar(32) NOT NULL,
	`encryptedApiSecret` text NOT NULL,
	`apiSecretIv` varchar(24) NOT NULL,
	`apiSecretTag` varchar(32) NOT NULL,
	`encryptedAccessToken` text NOT NULL,
	`accessTokenIv` varchar(24) NOT NULL,
	`accessTokenTag` varchar(32) NOT NULL,
	`encryptedAccessTokenSecret` text NOT NULL,
	`accessTokenSecretIv` varchar(24) NOT NULL,
	`accessTokenSecretTag` varchar(32) NOT NULL,
	`lastTestedAt` datetime,
	`lastTestError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `xAccountConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `x_account_connection_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `scheduledPostRuns` ADD CONSTRAINT `scheduledPostRuns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduledPostRuns` ADD CONSTRAINT `scheduledPostRuns_scheduledPostId_scheduledPosts_id_fk` FOREIGN KEY (`scheduledPostId`) REFERENCES `scheduledPosts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduledPosts` ADD CONSTRAINT `scheduledPosts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduledPosts` ADD CONSTRAINT `scheduledPosts_draftId_postDrafts_id_fk` FOREIGN KEY (`draftId`) REFERENCES `postDrafts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `xAccountConnections` ADD CONSTRAINT `xAccountConnections_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `scheduled_post_runs_post_started_idx` ON `scheduledPostRuns` (`scheduledPostId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `scheduled_post_runs_task_started_idx` ON `scheduledPostRuns` (`taskUid`,`startedAt`);--> statement-breakpoint
CREATE INDEX `scheduled_posts_user_status_datetime_idx` ON `scheduledPosts` (`userId`,`status`,`scheduledFor`);--> statement-breakpoint
CREATE INDEX `scheduled_posts_cron_idx` ON `scheduledPosts` (`scheduleCronTaskUid`);