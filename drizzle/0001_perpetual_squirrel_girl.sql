CREATE TABLE `growthSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`impressionsTarget` int NOT NULL DEFAULT 1000,
	`engagementRateTargetBps` int NOT NULL DEFAULT 300,
	`postsPerWeekTarget` int NOT NULL DEFAULT 3,
	`bannedWords` json NOT NULL,
	`analysisRules` text,
	`defaultTone` varchar(80) NOT NULL DEFAULT '知的で親しみやすい',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `growthSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `growth_settings_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`summary` text,
	`category` varchar(80) NOT NULL,
	`tags` json NOT NULL,
	`sourceUrl` varchar(2048),
	`personalExperience` text,
	`targetUser` varchar(180),
	`angle` text,
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('unused','drafting','published','archived') NOT NULL DEFAULT 'unused',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `postDrafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ideaId` int,
	`content` varchar(2000) NOT NULL,
	`tone` varchar(80) NOT NULL,
	`charLimit` int NOT NULL,
	`charCount` int NOT NULL,
	`readabilityScore` int NOT NULL,
	`qualityScore` int NOT NULL,
	`warnings` json NOT NULL,
	`status` enum('generated','selected','published','discarded') NOT NULL DEFAULT 'generated',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `postDrafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `postResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ideaId` int,
	`draftId` int,
	`title` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`postUrl` varchar(2048),
	`postedAt` datetime NOT NULL,
	`impressions` int NOT NULL DEFAULT 0,
	`engagements` int NOT NULL DEFAULT 0,
	`likes` int NOT NULL DEFAULT 0,
	`replies` int NOT NULL DEFAULT 0,
	`reposts` int NOT NULL DEFAULT 0,
	`bookmarks` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `postResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ideas_user_status_idx` ON `ideas` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `drafts_user_created_idx` ON `postDrafts` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `results_user_posted_idx` ON `postResults` (`userId`,`postedAt`);