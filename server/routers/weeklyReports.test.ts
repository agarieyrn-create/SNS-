import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ listWeeklyReports: vi.fn(), getGrowthSettings: vi.fn(), updateWeeklyReportSchedule: vi.fn() }));
vi.mock("../weekly-report", () => ({ generateWeeklyReport: vi.fn() }));
vi.mock("../_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(), updateHeartbeatJob: vi.fn() }));

import * as db from "../db";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { generateWeeklyReport } from "../weekly-report";
import { weeklyReportsRouter, WEEKLY_REPORT_CRON } from "./weeklyReports";

const user = { id: 42, openId: "weekly-user", name: "Weekly User", email: "weekly@example.com", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const ctx = { user, req: { headers: { cookie: "app_session_id=session-token" } }, res: {} } as TrpcContext;
const caller = weeklyReportsRouter.createCaller(ctx);
const scheduleSettings = { id: 1, userId: user.id, weeklyReportCronTaskUid: null, weeklyReportEnabled: true };

beforeEach(() => vi.clearAllMocks());

describe("weeklyReports router", () => {
  it("generates a report manually for the signed-in user", async () => {
    const generated = { report: { id: 8 }, created: true };
    vi.mocked(generateWeeklyReport).mockResolvedValue(generated as never);
    await expect(caller.generate()).resolves.toEqual(generated);
    expect(generateWeeklyReport).toHaveBeenCalledWith(user.id, "manual", true);
  });

  it("creates the Monday 09:00 JST schedule and persists its task id", async () => {
    vi.mocked(db.getGrowthSettings).mockResolvedValue(scheduleSettings as never);
    vi.mocked(createHeartbeatJob).mockResolvedValue({ taskUid: "weekly-task", nextExecutionAt: "2026-08-17T15:00:00.000Z" });
    vi.mocked(db.updateWeeklyReportSchedule).mockResolvedValue({ ...scheduleSettings, weeklyReportCronTaskUid: "weekly-task" } as never);

    const result = await caller.schedule({ enabled: true });

    expect(createHeartbeatJob).toHaveBeenCalledWith(expect.objectContaining({ cron: WEEKLY_REPORT_CRON, path: "/api/scheduled/weekly-report" }), "session-token");
    expect(db.updateWeeklyReportSchedule).toHaveBeenCalledWith(user.id, { weeklyReportEnabled: true, weeklyReportCronTaskUid: "weekly-task" });
    expect(result).toEqual(expect.objectContaining({ nextExecutionAt: "2026-08-17T15:00:00.000Z" }));
  });

  it("pauses an existing schedule when automatic generation is disabled", async () => {
    vi.mocked(db.getGrowthSettings).mockResolvedValue({ ...scheduleSettings, weeklyReportCronTaskUid: "weekly-task" } as never);
    vi.mocked(updateHeartbeatJob).mockResolvedValue({});
    vi.mocked(db.updateWeeklyReportSchedule).mockResolvedValue({ ...scheduleSettings, weeklyReportEnabled: false } as never);

    await caller.schedule({ enabled: false });

    expect(updateHeartbeatJob).toHaveBeenCalledWith("weekly-task", { enable: false }, "session-token");
    expect(db.updateWeeklyReportSchedule).toHaveBeenCalledWith(user.id, { weeklyReportEnabled: false });
  });
});
