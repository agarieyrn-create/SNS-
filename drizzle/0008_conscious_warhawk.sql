ALTER TABLE `growthSettings` ADD `xScheduledPostCronTaskUid` varchar(65);--> statement-breakpoint
CREATE INDEX `growth_settings_x_post_cron_idx` ON `growthSettings` (`xScheduledPostCronTaskUid`);