import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  listIdeas: vi.fn(),
  createIdea: vi.fn(),
  updateIdea: vi.fn(),
  deleteIdea: vi.fn(),
  getGrowthSettings: vi.fn(),
  saveGrowthSettings: vi.fn(),
  listDrafts: vi.fn(),
  updateDraft: vi.fn(),
  deleteDraft: vi.fn(),
  createDrafts: vi.fn(),
  listResults: vi.fn(),
  createResult: vi.fn(),
  importResults: vi.fn(),
  updateResult: vi.fn(),
  deleteResult: vi.fn(),
  getDashboard: vi.fn(),
  getExportData: vi.fn(),
}));

vi.mock("../_core/llm", () => ({
  listLLMModels: vi.fn(),
  invokeLLM: vi.fn(),
}));

import * as db from "../db";
import { invokeLLM, listLLMModels } from "../_core/llm";
import { growthRouter } from "./growth";

const user = {
  id: 42, openId: "growth-test-user", name: "Test User", email: "test@example.com", loginMethod: "manus" as const,
  role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
};
const ctx = { user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
const caller = growthRouter.createCaller(ctx);
const settings = { id: 1, userId: user.id, impressionsTarget: 1000, engagementRateTargetBps: 300, postsPerWeekTarget: 3, bannedWords: ["絶対"], analysisRules: "一次体験を中心にする。", defaultTone: "知的で親しみやすい", createdAt: new Date(), updatedAt: new Date() };
const validIdea = { title: "AIに業務を教える前に観察する", summary: "観察から始める", category: "AI × 業務効率化", tags: ["AI"], sourceUrl: null, personalExperience: "実務で試した", targetUser: "非エンジニア", angle: "失敗からの学び", priority: "high" as const, status: "unused" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getGrowthSettings).mockResolvedValue(settings);
});

describe("growth router", () => {
  it("creates an idea within the signed-in user's workspace", async () => {
    vi.mocked(db.createIdea).mockResolvedValue({ id: 7, userId: user.id, ...validIdea, createdAt: new Date(), updatedAt: new Date() });
    const result = await caller.ideas.create(validIdea);
    expect(db.createIdea).toHaveBeenCalledWith(user.id, validIdea);
    expect(result.id).toBe(7);
  });

  it("evaluates content against the saved banned-word rules", async () => {
    const result = await caller.evaluate({ content: "これは絶対に必要です。", charLimit: 280 });
    expect(result.charCount).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).toContain("禁止ワード");
  });

  it("persists the user's KPI and generation rules", async () => {
    vi.mocked(db.saveGrowthSettings).mockResolvedValue(settings);
    await caller.settings.save({ impressionsTarget: 2000, engagementRateTargetBps: 450, postsPerWeekTarget: 4, bannedWords: ["煽り"], analysisRules: "具体例を優先する。", defaultTone: "端的で親しみやすい" });
    expect(db.saveGrowthSettings).toHaveBeenCalledWith(user.id, expect.objectContaining({ impressionsTarget: 2000, engagementRateTargetBps: 450 }));
  });

  it("returns all user-scoped data for export", async () => {
    const payload = { exportedAt: new Date().toISOString(), ideas: [], drafts: [], results: [], weeklyReports: [], settings };
    vi.mocked(db.getExportData).mockResolvedValue(payload);
    await expect(caller.exportData()).resolves.toEqual(payload);
    expect(db.getExportData).toHaveBeenCalledWith(user.id);
  });

  it("generates structured drafts and saves them against the selected idea", async () => {
    const idea = { id: 11, userId: user.id, ...validIdea, createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(db.listIdeas).mockResolvedValue([idea]);
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ posts: ["観察を先にすると、AIへの指示は具体的になります。"] }) } }] } as never);
    await expect(caller.generate({ ideaId: idea.id, tone: "知的で親しみやすい", charLimit: 280, count: 1, model: "gpt-5-mini" })).resolves.toEqual({ success: true, createdCount: 1 });
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini" }));
    expect(db.createDrafts).toHaveBeenCalledWith(user.id, idea.id, "知的で親しみやすい", 280, ["観察を先にすると、AIへの指示は具体的になります。"], settings.bannedWords);
    expect(db.updateIdea).toHaveBeenCalledWith(user.id, idea.id, { status: "drafting" });
  });

  it("lists only model identifiers returned from the model catalog", async () => {
    vi.mocked(listLLMModels).mockResolvedValue({ data: [{ id: "gpt-5-mini" }, { id: "claude-haiku-4-5" }] } as never);
    await expect(caller.models()).resolves.toEqual([{ id: "gpt-5-mini" }, { id: "claude-haiku-4-5" }]);
  });

  it("updates and deletes only the selected draft in the signed-in workspace", async () => {
    vi.mocked(db.updateDraft).mockResolvedValue({ id: 5, userId: user.id, content: "更新済み投稿案" } as never);
    await caller.drafts.update({ id: 5, content: "更新済み投稿案", tone: "端的", charLimit: 280, status: "selected" });
    expect(db.updateDraft).toHaveBeenCalledWith(user.id, 5, "更新済み投稿案", "端的", 280, "selected", settings.bannedWords);
    vi.mocked(db.deleteDraft).mockResolvedValue({ success: true });
    await expect(caller.drafts.delete({ id: 5 })).resolves.toEqual({ success: true });
    expect(db.deleteDraft).toHaveBeenCalledWith(user.id, 5);
  });

  it("records, updates, and deletes manual performance data", async () => {
    const resultInput = { title: "投稿後の振り返り", category: "AI × 業務効率化", postUrl: null, postedAt: new Date("2026-08-14T10:00:00.000Z"), impressions: 1200, engagements: 48, likes: 30, replies: 5, reposts: 4, bookmarks: 6, clicks: 3, notes: "朝に投稿" };
    vi.mocked(db.createResult).mockResolvedValue({ id: 9, userId: user.id, ...resultInput } as never);
    await caller.results.create(resultInput);
    expect(db.createResult).toHaveBeenCalledWith(user.id, resultInput);
    vi.mocked(db.updateResult).mockResolvedValue({ id: 9, userId: user.id, ...resultInput, impressions: 1400 } as never);
    await caller.results.update({ id: 9, ...resultInput, impressions: 1400 });
    expect(db.updateResult).toHaveBeenCalledWith(user.id, 9, expect.objectContaining({ impressions: 1400 }));
    vi.mocked(db.deleteResult).mockResolvedValue({ success: true });
    await expect(caller.results.delete({ id: 9 })).resolves.toEqual({ success: true });
    expect(db.deleteResult).toHaveBeenCalledWith(user.id, 9);
  });

  it("imports validated performance rows into the signed-in workspace", async () => {
    const row = { ideaId: null, draftId: null, title: "CSVからの投稿", category: "AI × 業務効率化", postUrl: null, postedAt: new Date("2026-08-14T10:00:00.000Z"), impressions: 900, engagements: 34, likes: 20, replies: 4, reposts: 3, bookmarks: 5, clicks: 2, notes: "インポート" };
    vi.mocked(db.importResults).mockResolvedValue({ imported: 1 });
    await expect(caller.results.import({ rows: [row] })).resolves.toEqual({ imported: 1 });
    expect(db.importResults).toHaveBeenCalledWith(user.id, [row]);
  });

  it("returns the aggregated dashboard exactly for the signed-in workspace", async () => {
    const dashboard = { summary: { postCount: 2 }, trend: [], categoryBreakdown: [], recentResults: [] };
    vi.mocked(db.getDashboard).mockResolvedValue(dashboard as never);
    await expect(caller.dashboard()).resolves.toEqual(dashboard);
    expect(db.getDashboard).toHaveBeenCalledWith(user.id);
  });

  it("rejects generation when the selected idea is not owned by the signed-in user", async () => {
    vi.mocked(db.listIdeas).mockResolvedValue([]);
    await expect(caller.generate({ ideaId: 99, tone: "知的で親しみやすい", charLimit: 280, count: 1, model: "gpt-5-mini" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects generation when the LLM response is not valid structured JSON", async () => {
    const idea = { id: 12, userId: user.id, ...validIdea, createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(db.listIdeas).mockResolvedValue([idea]);
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: "投稿案1: これはJSONではありません" } }] } as never);
    await expect(caller.generate({ ideaId: idea.id, tone: "知的で親しみやすい", charLimit: 280, count: 1, model: "gpt-5-mini" })).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(db.createDrafts).not.toHaveBeenCalled();
  });

  it("rejects generation when the LLM omits content", async () => {
    const idea = { id: 13, userId: user.id, ...validIdea, createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(db.listIdeas).mockResolvedValue([idea]);
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: null } }] } as never);
    await expect(caller.generate({ ideaId: idea.id, tone: "知的で親しみやすい", charLimit: 280, count: 1, model: "gpt-5-mini" })).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });
});
