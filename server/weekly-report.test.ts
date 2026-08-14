import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getWeeklyReportByWeek: vi.fn(),
  listResultsInRange: vi.fn(),
  getGrowthSettings: vi.fn(),
  saveWeeklyReport: vi.fn(),
  updateWeeklyReportSchedule: vi.fn(),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { generateWeeklyReport, getPreviousJstWeekRange } from "./weekly-report";

const settings = { impressionsTarget: 1000, engagementRateTargetBps: 300 };
const row = (category: string, impressions: number, engagements: number) => ({ category, impressions, engagements });

beforeEach(() => vi.clearAllMocks());

describe("getPreviousJstWeekRange", () => {
  it("returns the completed Monday-to-Monday period in JST", () => {
    const range = getPreviousJstWeekRange(new Date("2026-08-16T15:00:00.000Z"));
    expect(range.start.toISOString()).toBe("2026-08-09T15:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-16T15:00:00.000Z");
  });
});

describe("generateWeeklyReport", () => {
  it("aggregates the previous week, generates insights, and persists one report", async () => {
    vi.mocked(db.getWeeklyReportByWeek).mockResolvedValue(undefined);
    vi.mocked(db.listResultsInRange).mockResolvedValueOnce([row("AI × 業務効率化", 1200, 48), row("AI × 実践記録", 800, 40)] as never).mockResolvedValueOnce([row("AI × 業務効率化", 1000, 25)] as never);
    vi.mocked(db.getGrowthSettings).mockResolvedValue(settings as never);
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ headline: "実験の反応を次の投稿へつなげる週です。", summary: "反応率は改善しました。", wins: ["実践記録が高反応でした。"], risks: ["投稿数が少なめです。"], actions: ["実践記録を再検証する。", "冒頭を具体化する。", "24時間後に記録する。"] }) } }] } as never);
    const saved = { id: 3, userId: 42, weekStart: new Date(), weekEnd: new Date() };
    vi.mocked(db.saveWeeklyReport).mockResolvedValue(saved as never);
    vi.mocked(db.updateWeeklyReportSchedule).mockResolvedValue(settings as never);

    const result = await generateWeeklyReport(42, "manual", true);

    expect(result).toEqual({ report: saved, created: true });
    expect(db.saveWeeklyReport).toHaveBeenCalledWith(42, expect.objectContaining({ source: "manual", postCount: 2, impressions: 2000, engagements: 88, engagementRateBps: 440 }));
    expect(db.updateWeeklyReportSchedule).toHaveBeenCalledWith(42, expect.objectContaining({ weeklyReportLastGeneratedAt: expect.any(Date) }));
  });

  it("uses deterministic insight text when the LLM response is unusable", async () => {
    vi.mocked(db.getWeeklyReportByWeek).mockResolvedValue(undefined);
    vi.mocked(db.listResultsInRange).mockResolvedValueOnce([row("AI × 業務効率化", 200, 4)] as never).mockResolvedValueOnce([] as never);
    vi.mocked(db.getGrowthSettings).mockResolvedValue(settings as never);
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: "not-json" } }] } as never);
    vi.mocked(db.saveWeeklyReport).mockImplementation(async (_userId, input) => ({ id: 4, userId: 42, ...input } as never));
    vi.mocked(db.updateWeeklyReportSchedule).mockResolvedValue(settings as never);

    const result = await generateWeeklyReport(42, "manual", true);

    expect(result.report.insights.headline).toContain("投稿");
    expect(result.report.insights.actions).toHaveLength(3);
  });

  it("returns an existing scheduled report without recomputing it", async () => {
    const existing = { id: 5, userId: 42, weekStart: new Date(), weekEnd: new Date() };
    vi.mocked(db.getWeeklyReportByWeek).mockResolvedValue(existing as never);
    await expect(generateWeeklyReport(42, "scheduled", false)).resolves.toEqual({ report: existing, created: false });
    expect(db.listResultsInRange).not.toHaveBeenCalled();
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});
