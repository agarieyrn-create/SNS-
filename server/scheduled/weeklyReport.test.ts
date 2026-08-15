import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ getGrowthSettingsByWeeklyCronTaskUid: vi.fn(), createWeeklyReportRun: vi.fn(), finishWeeklyReportRun: vi.fn() }));
vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("../weekly-report", () => ({ generateWeeklyReport: vi.fn() }));

import * as db from "../db";
import { sdk } from "../_core/sdk";
import { generateWeeklyReport } from "../weekly-report";
import { runWeeklyReportSchedule } from "./weeklyReport";

function makeResponse() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

beforeEach(() => vi.clearAllMocks());

describe("runWeeklyReportSchedule", () => {
  it("generates a scheduled report for the task owner", async () => {
    const res = makeResponse();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: true, taskUid: "weekly-task" } as never);
    vi.mocked(db.getGrowthSettingsByWeeklyCronTaskUid).mockResolvedValue({ userId: 42, weeklyReportEnabled: true } as never);
    vi.mocked(db.createWeeklyReportRun).mockResolvedValue({ id: 3, startedAt: new Date() } as never);
    vi.mocked(generateWeeklyReport).mockResolvedValue({ report: { id: 17 }, created: true } as never);

    await runWeeklyReportSchedule({ path: "/api/scheduled/weekly-report" } as never, res as never);

    expect(generateWeeklyReport).toHaveBeenCalledWith(42, "scheduled", false);
    expect(db.createWeeklyReportRun).toHaveBeenCalledWith(42, { taskUid: "weekly-task", trigger: "scheduled" });
    expect(db.finishWeeklyReportRun).toHaveBeenCalledWith(3, { status: "succeeded", reportId: 17 });
    expect(res.json).toHaveBeenCalledWith({ ok: true, reportId: 17, created: true, runId: 3 });
  });

  it("returns a non-retrying success for an orphaned schedule", async () => {
    const res = makeResponse();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: true, taskUid: "missing-task" } as never);
    vi.mocked(db.getGrowthSettingsByWeeklyCronTaskUid).mockResolvedValue(undefined);

    await runWeeklyReportSchedule({ path: "/api/scheduled/weekly-report" } as never, res as never);

    expect(generateWeeklyReport).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
  });

  it("rejects non-cron callers", async () => {
    const res = makeResponse();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: false } as never);

    await runWeeklyReportSchedule({ path: "/api/scheduled/weekly-report" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });
});
