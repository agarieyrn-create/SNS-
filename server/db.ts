import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { GrowthSettings, growthSettings, ideas, InsertUser, postDrafts, postResults, users } from "../drizzle/schema";
import { calculateEngagementRate, makeTrend, reviewPost } from "./growth-utils";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const defaultSettings = (userId: number) => ({
  userId,
  impressionsTarget: 1000,
  engagementRateTargetBps: 300,
  postsPerWeekTarget: 3,
  bannedWords: [] as string[],
  analysisRules: "具体例・一次体験・読者の次の一歩を必ず確認する。",
  defaultTone: "知的で親しみやすい",
});

export async function getGrowthSettings(userId: number): Promise<GrowthSettings> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(growthSettings).where(eq(growthSettings.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(growthSettings).values(defaultSettings(userId));
  const created = await db.select().from(growthSettings).where(eq(growthSettings.userId, userId)).limit(1);
  if (!created[0]) throw new Error("Could not initialize settings");
  return created[0];
}

export async function saveGrowthSettings(userId: number, updates: Omit<ReturnType<typeof defaultSettings>, "userId">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(growthSettings).values({ userId, ...updates }).onDuplicateKeyUpdate({ set: updates });
  return getGrowthSettings(userId);
}

export async function listIdeas(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(ideas).where(eq(ideas.userId, userId)).orderBy(desc(ideas.updatedAt));
}

export async function createIdea(userId: number, input: Omit<typeof ideas.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [created] = await db.insert(ideas).values({ ...input, userId }).$returningId();
  const rows = await db.select().from(ideas).where(eq(ideas.id, created.id)).limit(1);
  return rows[0];
}

export async function updateIdea(userId: number, id: number, input: Partial<Omit<typeof ideas.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopedWhere = and(eq(ideas.id, id), eq(ideas.userId, userId));
  const existing = await db.select().from(ideas).where(scopedWhere).limit(1);
  if (!existing[0]) throw new Error("Idea not found");
  await db.update(ideas).set(input).where(scopedWhere);
  const rows = await db.select().from(ideas).where(scopedWhere).limit(1);
  if (!rows[0]) throw new Error("Idea not found");
  return rows[0];
}

export async function deleteIdea(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopedWhere = and(eq(ideas.id, id), eq(ideas.userId, userId));
  const rows = await db.select().from(ideas).where(scopedWhere).limit(1);
  if (!rows[0]) throw new Error("Idea not found");
  await db.delete(ideas).where(scopedWhere);
  return { success: true } as const;
}

export async function listDrafts(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(postDrafts).where(eq(postDrafts.userId, userId)).orderBy(desc(postDrafts.updatedAt));
}

export async function createDrafts(userId: number, ideaId: number | null, tone: string, charLimit: number, contents: string[], bannedWords: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (!contents.length) return [];
  const values = contents.map(content => {
    const review = reviewPost(content, charLimit, bannedWords);
    return { userId, ideaId, tone, charLimit, content, ...review };
  });
  await db.insert(postDrafts).values(values);
  return listDrafts(userId);
}

export async function updateDraft(userId: number, id: number, content: string, tone: string, charLimit: number, status: "generated" | "selected" | "published" | "discarded", bannedWords: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopedWhere = and(eq(postDrafts.id, id), eq(postDrafts.userId, userId));
  const existing = await db.select().from(postDrafts).where(scopedWhere).limit(1);
  if (!existing[0]) throw new Error("Draft not found");
  const review = reviewPost(content, charLimit, bannedWords);
  await db.update(postDrafts).set({ content, tone, charLimit, status, ...review }).where(scopedWhere);
  const rows = await db.select().from(postDrafts).where(scopedWhere).limit(1);
  return rows[0];
}

export async function deleteDraft(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopedWhere = and(eq(postDrafts.id, id), eq(postDrafts.userId, userId));
  const existing = await db.select().from(postDrafts).where(scopedWhere).limit(1);
  if (!existing[0]) throw new Error("Draft not found");
  await db.delete(postDrafts).where(scopedWhere);
  return { success: true } as const;
}

export async function listResults(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(postResults).where(eq(postResults.userId, userId)).orderBy(desc(postResults.postedAt));
}

export async function createResult(userId: number, input: Omit<typeof postResults.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [created] = await db.insert(postResults).values({ ...input, userId }).$returningId();
  const rows = await db.select().from(postResults).where(eq(postResults.id, created.id)).limit(1);
  return rows[0];
}

export async function updateResult(userId: number, id: number, input: Partial<Omit<typeof postResults.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopedWhere = and(eq(postResults.id, id), eq(postResults.userId, userId));
  const existing = await db.select().from(postResults).where(scopedWhere).limit(1);
  if (!existing[0]) throw new Error("Result not found");
  await db.update(postResults).set(input).where(scopedWhere);
  const rows = await db.select().from(postResults).where(scopedWhere).limit(1);
  return rows[0];
}

export async function deleteResult(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopedWhere = and(eq(postResults.id, id), eq(postResults.userId, userId));
  const existing = await db.select().from(postResults).where(scopedWhere).limit(1);
  if (!existing[0]) throw new Error("Result not found");
  await db.delete(postResults).where(scopedWhere);
  return { success: true } as const;
}

export async function getDashboard(userId: number) {
  const [results, allIdeas, settings] = await Promise.all([listResults(userId), listIdeas(userId), getGrowthSettings(userId)]);
  const impressions = results.reduce((sum, row) => sum + row.impressions, 0);
  const engagements = results.reduce((sum, row) => sum + row.engagements, 0);
  const categoryMap = new Map<string, { posts: number; impressions: number; engagements: number }>();
  results.forEach(row => {
    const current = categoryMap.get(row.category) ?? { posts: 0, impressions: 0, engagements: 0 };
    current.posts += 1;
    current.impressions += row.impressions;
    current.engagements += row.engagements;
    categoryMap.set(row.category, current);
  });
  return {
    summary: {
      postCount: results.length,
      ideaCount: allIdeas.filter(idea => idea.status === "unused").length,
      impressions,
      engagements,
      engagementRate: calculateEngagementRate(impressions, engagements),
      impressionsTarget: settings.impressionsTarget,
      engagementRateTarget: settings.engagementRateTargetBps / 100,
    },
    trend: makeTrend(results),
    categoryBreakdown: Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data,
      engagementRate: calculateEngagementRate(data.impressions, data.engagements),
    })),
    recentResults: results.slice(0, 5),
  };
}

export async function getExportData(userId: number) {
  const [ideaRows, resultRows, draftRows, settings] = await Promise.all([listIdeas(userId), listResults(userId), listDrafts(userId), getGrowthSettings(userId)]);
  return { exportedAt: new Date().toISOString(), ideas: ideaRows, results: resultRows, drafts: draftRows, settings };
}
