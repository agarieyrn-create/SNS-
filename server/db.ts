import { and, desc, eq, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { AiProviderConnection, aiProviderConnections, GrowthSettings, growthSettings, ideas, InsertUser, postDrafts, postResults, users, weeklyReportRuns, weeklyReports } from "../drizzle/schema";
import { calculateEngagementRate, makeTrend, reviewPost } from "./growth-utils";
import { ENV } from "./_core/env";
import { AiProvider, AI_PROVIDERS, encryptApiKey } from "./ai-provider-gateway";

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

export type AiProviderConnectionSummary = { provider: AiProvider; model: string; enabled: boolean; priority: number; registered: boolean };

export async function listAiProviderConnections(userId: number): Promise<AiProviderConnectionSummary[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(aiProviderConnections).where(eq(aiProviderConnections.userId, userId)).orderBy(aiProviderConnections.priority);
  const byProvider = new Map(rows.map(row => [row.provider, row]));
  return AI_PROVIDERS.map((provider, index) => {
    const row = byProvider.get(provider);
    return { provider, model: row?.model ?? "", enabled: row?.enabled ?? false, priority: row?.priority ?? index + 1, registered: Boolean(row) };
  }).sort((left, right) => left.priority - right.priority);
}

export async function getAiProviderConnectionsForUse(userId: number): Promise<AiProviderConnection[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(aiProviderConnections).where(and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.enabled, true))).orderBy(aiProviderConnections.priority);
}

export async function saveAiProviderConnection(userId: number, input: { provider: AiProvider; apiKey?: string; model: string; enabled: boolean; priority: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(aiProviderConnections).where(and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.provider, input.provider))).limit(1);
  const apiKey = input.apiKey?.trim();
  if (!existing[0] && !apiKey) throw new Error("初回登録時はAPIキーを入力してください。");
  const encrypted = apiKey ? encryptApiKey(apiKey) : null;
  if (!existing[0]) {
    await db.insert(aiProviderConnections).values({ userId, provider: input.provider, model: input.model, enabled: input.enabled, priority: input.priority, ...encrypted! });
  } else {
    await db.update(aiProviderConnections).set({ model: input.model, enabled: input.enabled, priority: input.priority, ...(encrypted ?? {}) }).where(and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.provider, input.provider)));
  }
  return listAiProviderConnections(userId);
}

export async function updateAiProviderPriority(userId: number, priorities: Array<{ provider: AiProvider; priority: number; enabled: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await Promise.all(priorities.map(item => db.update(aiProviderConnections).set({ priority: item.priority, enabled: item.enabled }).where(and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.provider, item.provider)))));
  return listAiProviderConnections(userId);
}

export async function deleteAiProviderConnection(userId: number, provider: AiProvider) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(aiProviderConnections).where(and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.provider, provider)));
  return listAiProviderConnections(userId);
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
  // Preserve the user's existing drafts and performance history after the
  // originating idea is removed.
  await db.update(postDrafts).set({ ideaId: null }).where(and(eq(postDrafts.userId, userId), eq(postDrafts.ideaId, id)));
  await db.update(postResults).set({ ideaId: null }).where(and(eq(postResults.userId, userId), eq(postResults.ideaId, id)));
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
  if (ideaId) {
    const idea = await db.select({ id: ideas.id }).from(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId))).limit(1);
    if (!idea[0]) throw new Error("Related idea not found");
  }
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
  // The database foreign key clears postResults.draftId while preserving performance history.
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
  if (input.ideaId) {
    const idea = await db.select({ id: ideas.id }).from(ideas).where(and(eq(ideas.id, input.ideaId), eq(ideas.userId, userId))).limit(1);
    if (!idea[0]) throw new Error("Related idea not found");
  }
  if (input.draftId) {
    const draft = await db.select({ id: postDrafts.id }).from(postDrafts).where(and(eq(postDrafts.id, input.draftId), eq(postDrafts.userId, userId))).limit(1);
    if (!draft[0]) throw new Error("Related draft not found");
  }
  const [created] = await db.insert(postResults).values({ ...input, userId }).$returningId();
  const rows = await db.select().from(postResults).where(eq(postResults.id, created.id)).limit(1);
  return rows[0];
}

export async function importResults(userId: number, inputs: Array<Omit<typeof postResults.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (!inputs.length) return { imported: 0, duplicates: 0, duplicateRows: [] as number[] } as const;
  const existing = await db.select({ title: postResults.title, postUrl: postResults.postUrl, postedAt: postResults.postedAt }).from(postResults).where(eq(postResults.userId, userId));
  const toKey = (row: { title: string; postUrl?: string | null; postedAt: Date }) => row.postUrl ? `url:${row.postUrl.trim().toLowerCase()}` : `fallback:${row.title.trim().toLowerCase()}|${new Date(row.postedAt).toISOString()}`;
  const known = new Set(existing.map(toKey));
  const duplicateRows: number[] = [];
  const importable = inputs.filter((input, index) => {
    const key = toKey({ title: input.title, postUrl: input.postUrl, postedAt: input.postedAt });
    if (known.has(key)) { duplicateRows.push(index + 2); return false; }
    known.add(key);
    return true;
  });
  if (importable.length) await db.insert(postResults).values(importable.map(input => ({ ...input, userId })));
  return { imported: importable.length, duplicates: duplicateRows.length, duplicateRows };
}

export async function previewResultImport(userId: number, inputs: Array<Omit<typeof postResults.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select({ title: postResults.title, postUrl: postResults.postUrl, postedAt: postResults.postedAt }).from(postResults).where(eq(postResults.userId, userId));
  const toKey = (row: { title: string; postUrl?: string | null; postedAt: Date }) => row.postUrl ? `url:${row.postUrl.trim().toLowerCase()}` : `fallback:${row.title.trim().toLowerCase()}|${new Date(row.postedAt).toISOString()}`;
  const known = new Set(existing.map(toKey));
  const duplicateRows: number[] = [];
  inputs.forEach((input, index) => {
    const key = toKey({ title: input.title, postUrl: input.postUrl, postedAt: input.postedAt });
    if (known.has(key)) duplicateRows.push(index + 2);
    else known.add(key);
  });
  return { accepted: inputs.length - duplicateRows.length, duplicateRows };
}

export async function updateResult(userId: number, id: number, input: Partial<Omit<typeof postResults.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopedWhere = and(eq(postResults.id, id), eq(postResults.userId, userId));
  const existing = await db.select().from(postResults).where(scopedWhere).limit(1);
  if (!existing[0]) throw new Error("Result not found");
  if (input.ideaId !== undefined && input.ideaId !== null) {
    const idea = await db.select({ id: ideas.id }).from(ideas).where(and(eq(ideas.id, input.ideaId), eq(ideas.userId, userId))).limit(1);
    if (!idea[0]) throw new Error("Related idea not found");
  }
  if (input.draftId !== undefined && input.draftId !== null) {
    const draft = await db.select({ id: postDrafts.id }).from(postDrafts).where(and(eq(postDrafts.id, input.draftId), eq(postDrafts.userId, userId))).limit(1);
    if (!draft[0]) throw new Error("Related draft not found");
  }
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
  const [ideaRows, resultRows, draftRows, reportRows, settings] = await Promise.all([listIdeas(userId), listResults(userId), listDrafts(userId), listWeeklyReports(userId), getGrowthSettings(userId)]);
  return { exportedAt: new Date().toISOString(), ideas: ideaRows, results: resultRows, drafts: draftRows, weeklyReports: reportRows, settings };
}

export async function listResultsInRange(userId: number, start: Date, end: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(postResults).where(and(eq(postResults.userId, userId), gte(postResults.postedAt, start), lt(postResults.postedAt, end))).orderBy(desc(postResults.postedAt));
}

export async function getWeeklyReportByWeek(userId: number, weekStart: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(weeklyReports).where(and(eq(weeklyReports.userId, userId), eq(weeklyReports.weekStart, weekStart))).limit(1);
  return rows[0];
}

export async function listWeeklyReports(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(weeklyReports).where(eq(weeklyReports.userId, userId)).orderBy(desc(weeklyReports.weekStart));
}

export async function createWeeklyReportRun(userId: number, input: { taskUid?: string | null; trigger: "manual" | "scheduled" | "retry" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const startedAt = new Date();
  const [created] = await db.insert(weeklyReportRuns).values({ userId, taskUid: input.taskUid ?? null, trigger: input.trigger, status: "running", startedAt }).$returningId();
  return { id: created.id, startedAt };
}

export async function finishWeeklyReportRun(id: number, input: { status: "succeeded" | "failed" | "skipped"; reportId?: number | null; error?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(weeklyReportRuns).set({ status: input.status, reportId: input.reportId ?? null, error: input.error ?? null, finishedAt: new Date() }).where(eq(weeklyReportRuns.id, id));
}

export async function listWeeklyReportRuns(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(weeklyReportRuns).where(eq(weeklyReportRuns.userId, userId)).orderBy(desc(weeklyReportRuns.startedAt)).limit(12);
}

export async function saveWeeklyReport(userId: number, input: Omit<typeof weeklyReports.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(weeklyReports).values({ userId, ...input }).onDuplicateKeyUpdate({ set: input });
  const report = await getWeeklyReportByWeek(userId, input.weekStart);
  if (!report) throw new Error("Could not save weekly report");
  return report;
}

export async function updateWeeklyReportSchedule(userId: number, updates: Partial<Pick<typeof growthSettings.$inferInsert, "weeklyReportEnabled" | "weeklyReportCronTaskUid" | "weeklyReportLastGeneratedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await getGrowthSettings(userId);
  await db.update(growthSettings).set(updates).where(eq(growthSettings.userId, userId));
  return getGrowthSettings(userId);
}

export async function getGrowthSettingsByWeeklyCronTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(growthSettings).where(eq(growthSettings.weeklyReportCronTaskUid, taskUid)).limit(1);
  return rows[0];
}
