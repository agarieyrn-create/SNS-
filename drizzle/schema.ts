import { datetime, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  userId: int("userId").notNull(),
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
  userId: int("userId").notNull(),
  ideaId: int("ideaId"),
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
  userId: int("userId").notNull(),
  ideaId: int("ideaId"),
  draftId: int("draftId"),
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
  userId: int("userId").notNull(),
  impressionsTarget: int("impressionsTarget").default(1000).notNull(),
  engagementRateTargetBps: int("engagementRateTargetBps").default(300).notNull(),
  postsPerWeekTarget: int("postsPerWeekTarget").default(3).notNull(),
  bannedWords: json("bannedWords").$type<string[]>().notNull(),
  analysisRules: text("analysisRules"),
  defaultTone: varchar("defaultTone", { length: 80 }).default("知的で親しみやすい").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("growth_settings_user_unique").on(table.userId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Idea = typeof ideas.$inferSelect;
export type PostDraft = typeof postDrafts.$inferSelect;
export type PostResult = typeof postResults.$inferSelect;
export type GrowthSettings = typeof growthSettings.$inferSelect;
