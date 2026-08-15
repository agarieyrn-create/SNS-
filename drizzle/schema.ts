import { boolean, datetime, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const ideas = mysqlTable("ideas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(),
  summary: text("summary"),
  category: varchar("category", { length: 80 }).notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  sourceUrl: varchar("sourceUrl", { length: 2048 }),
  personalExperience: text("personalExperience"),
  targetUser: varchar("targetUser", { length: 180 }),
  angle: text("angle"),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  status: mysqlEnum("status", ["unused", "drafting", "published", "archived"]).default("unused").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("ideas_user_status_idx").on(table.userId, table.status)]);

export const postDrafts = mysqlTable("postDrafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  ideaId: int("ideaId").references(() => ideas.id, { onDelete: "set null" }),
  content: varchar("content", { length: 2000 }).notNull(),
  tone: varchar("tone", { length: 80 }).notNull(),
  charLimit: int("charLimit").notNull(),
  charCount: int("charCount").notNull(),
  readabilityScore: int("readabilityScore").notNull(),
  qualityScore: int("qualityScore").notNull(),
  warnings: json("warnings").$type<string[]>().notNull(),
  status: mysqlEnum("status", ["generated", "selected", "published", "discarded"]).default("generated").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("drafts_user_created_idx").on(table.userId, table.createdAt)]);

export const postResults = mysqlTable("postResults", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  ideaId: int("ideaId").references(() => ideas.id, { onDelete: "set null" }),
  draftId: int("draftId").references(() => postDrafts.id, { onDelete: "set null" }),
  title: varchar("title", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  postUrl: varchar("postUrl", { length: 2048 }),
  postedAt: datetime("postedAt").notNull(),
  impressions: int("impressions").default(0).notNull(),
  engagements: int("engagements").default(0).notNull(),
  likes: int("likes").default(0).notNull(),
  replies: int("replies").default(0).notNull(),
  reposts: int("reposts").default(0).notNull(),
  bookmarks: int("bookmarks").default(0).notNull(),
  clicks: int("clicks").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("results_user_posted_idx").on(table.userId, table.postedAt)]);

export const growthSettings = mysqlTable("growthSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  impressionsTarget: int("impressionsTarget").default(1000).notNull(),
  engagementRateTargetBps: int("engagementRateTargetBps").default(300).notNull(),
  postsPerWeekTarget: int("postsPerWeekTarget").default(3).notNull(),
  bannedWords: json("bannedWords").$type<string[]>().notNull(),
  analysisRules: text("analysisRules"),
  defaultTone: varchar("defaultTone", { length: 80 }).default("知的で親しみやすい").notNull(),
  weeklyReportEnabled: boolean("weeklyReportEnabled").default(true).notNull(),
  weeklyReportCronTaskUid: varchar("weeklyReportCronTaskUid", { length: 65 }),
  weeklyReportLastGeneratedAt: datetime("weeklyReportLastGeneratedAt"),
  xScheduledPostCronTaskUid: varchar("xScheduledPostCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("growth_settings_user_unique").on(table.userId), index("growth_settings_weekly_cron_idx").on(table.weeklyReportCronTaskUid), index("growth_settings_x_post_cron_idx").on(table.xScheduledPostCronTaskUid)]);

export const aiProviderConnections = mysqlTable("aiProviderConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: mysqlEnum("provider", ["openai", "anthropic", "gemini", "openrouter"]).notNull(),
  encryptedApiKey: text("encryptedApiKey").notNull(),
  encryptionIv: varchar("encryptionIv", { length: 24 }).notNull(),
  encryptionTag: varchar("encryptionTag", { length: 32 }).notNull(),
  model: varchar("model", { length: 160 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  priority: int("priority").default(1).notNull(),
  monthlyRequestLimit: int("monthlyRequestLimit").default(100).notNull(),
  monthlyBudgetMilliUsd: int("monthlyBudgetMilliUsd").default(1000).notNull(),
  perRequestReservationMilliUsd: int("perRequestReservationMilliUsd").default(50).notNull(),
  lastTestedAt: datetime("lastTestedAt"),
  lastTestError: text("lastTestError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("ai_provider_connection_user_provider_unique").on(table.userId, table.provider), index("ai_provider_connection_user_priority_idx").on(table.userId, table.priority)]);

export const aiUsageRecords = mysqlTable("aiUsageRecords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  connectionId: int("connectionId").references(() => aiProviderConnections.id, { onDelete: "set null" }),
  provider: mysqlEnum("provider", ["openai", "anthropic", "gemini", "openrouter"]).notNull(),
  action: mysqlEnum("action", ["generate", "rewrite", "connection_test"]).notNull(),
  status: mysqlEnum("status", ["reserved", "succeeded", "failed"]).notNull(),
  reservedCostMilliUsd: int("reservedCostMilliUsd").notNull(),
  chargedCostMilliUsd: int("chargedCostMilliUsd"),
  inputTokens: int("inputTokens"),
  outputTokens: int("outputTokens"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: datetime("completedAt"),
}, table => [index("ai_usage_records_user_provider_month_idx").on(table.userId, table.provider, table.createdAt), index("ai_usage_records_connection_month_idx").on(table.connectionId, table.createdAt)]);

export const xAccountConnections = mysqlTable("xAccountConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  encryptedApiKey: text("encryptedApiKey").notNull(),
  apiKeyIv: varchar("apiKeyIv", { length: 24 }).notNull(),
  apiKeyTag: varchar("apiKeyTag", { length: 32 }).notNull(),
  encryptedApiSecret: text("encryptedApiSecret").notNull(),
  apiSecretIv: varchar("apiSecretIv", { length: 24 }).notNull(),
  apiSecretTag: varchar("apiSecretTag", { length: 32 }).notNull(),
  encryptedAccessToken: text("encryptedAccessToken").notNull(),
  accessTokenIv: varchar("accessTokenIv", { length: 24 }).notNull(),
  accessTokenTag: varchar("accessTokenTag", { length: 32 }).notNull(),
  encryptedAccessTokenSecret: text("encryptedAccessTokenSecret").notNull(),
  accessTokenSecretIv: varchar("accessTokenSecretIv", { length: 24 }).notNull(),
  accessTokenSecretTag: varchar("accessTokenSecretTag", { length: 32 }).notNull(),
  lastTestedAt: datetime("lastTestedAt"),
  lastTestError: text("lastTestError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("x_account_connection_user_unique").on(table.userId)]);

export const scheduledPosts = mysqlTable("scheduledPosts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  draftId: int("draftId").references(() => postDrafts.id, { onDelete: "set null" }),
  content: varchar("content", { length: 2000 }).notNull(),
  scheduledFor: datetime("scheduledFor").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Tokyo").notNull(),
  status: mysqlEnum("status", ["scheduled", "publishing", "published", "failed", "cancelled"]).default("scheduled").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  nextAttemptTrigger: mysqlEnum("nextAttemptTrigger", ["scheduled", "retry"]).default("scheduled").notNull(),
  attemptCount: int("attemptCount").default(0).notNull(),
  xPostId: varchar("xPostId", { length: 64 }),
  postedAt: datetime("postedAt"),
  lastAttemptAt: datetime("lastAttemptAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("scheduled_posts_user_status_datetime_idx").on(table.userId, table.status, table.scheduledFor), index("scheduled_posts_cron_idx").on(table.scheduleCronTaskUid)]);

export const scheduledPostRuns = mysqlTable("scheduledPostRuns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  scheduledPostId: int("scheduledPostId").notNull().references(() => scheduledPosts.id, { onDelete: "cascade" }),
  taskUid: varchar("taskUid", { length: 65 }),
  trigger: mysqlEnum("trigger", ["scheduled", "retry"]).notNull(),
  status: mysqlEnum("status", ["running", "succeeded", "failed", "skipped"]).notNull(),
  xPostId: varchar("xPostId", { length: 64 }),
  error: text("error"),
  startedAt: datetime("startedAt").notNull(),
  finishedAt: datetime("finishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("scheduled_post_runs_post_started_idx").on(table.scheduledPostId, table.startedAt), index("scheduled_post_runs_task_started_idx").on(table.taskUid, table.startedAt)]);

export const weeklyReports = mysqlTable("weeklyReports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: datetime("weekStart").notNull(),
  weekEnd: datetime("weekEnd").notNull(),
  source: mysqlEnum("source", ["manual", "scheduled"]).notNull(),
  postCount: int("postCount").notNull(),
  impressions: int("impressions").notNull(),
  engagements: int("engagements").notNull(),
  engagementRateBps: int("engagementRateBps").notNull(),
  impressionChangePct: int("impressionChangePct"),
  engagementRateChangeBps: int("engagementRateChangeBps"),
  categoryBreakdown: json("categoryBreakdown").$type<Array<{ category: string; posts: number; impressions: number; engagements: number; engagementRate: number }>>().notNull(),
  insights: json("insights").$type<{ headline: string; summary: string; wins: string[]; risks: string[]; actions: string[] }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("weekly_reports_user_week_unique").on(table.userId, table.weekStart), index("weekly_reports_user_created_idx").on(table.userId, table.createdAt)]);

export const weeklyReportRuns = mysqlTable("weeklyReportRuns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskUid: varchar("taskUid", { length: 65 }),
  trigger: mysqlEnum("trigger", ["manual", "scheduled", "retry"]).notNull(),
  status: mysqlEnum("status", ["running", "succeeded", "failed", "skipped"]).notNull(),
  reportId: int("reportId").references(() => weeklyReports.id, { onDelete: "set null" }),
  error: text("error"),
  startedAt: datetime("startedAt").notNull(),
  finishedAt: datetime("finishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("weekly_report_runs_user_started_idx").on(table.userId, table.startedAt), index("weekly_report_runs_task_started_idx").on(table.taskUid, table.startedAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Idea = typeof ideas.$inferSelect;
export type PostDraft = typeof postDrafts.$inferSelect;
export type PostResult = typeof postResults.$inferSelect;
export type GrowthSettings = typeof growthSettings.$inferSelect;
export type AiProviderConnection = typeof aiProviderConnections.$inferSelect;
export type AiUsageRecord = typeof aiUsageRecords.$inferSelect;
export type XAccountConnection = typeof xAccountConnections.$inferSelect;
export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type ScheduledPostRun = typeof scheduledPostRuns.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type WeeklyReportRun = typeof weeklyReportRuns.$inferSelect;
