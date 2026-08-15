import type { Request, Response } from "express";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import { generateWeeklyReport } from "../weekly-report";

export async function runWeeklyReportSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const settings = await db.getGrowthSettingsByWeeklyCronTaskUid(user.taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    const run = await db.createWeeklyReportRun(settings.userId, { taskUid: user.taskUid, trigger: "scheduled" });
    if (!settings.weeklyReportEnabled) {
      await db.finishWeeklyReportRun(run.id, { status: "skipped", error: "Schedule is disabled" });
      return res.json({ ok: true, skipped: "disabled", runId: run.id });
    }
    try {
      const result = await generateWeeklyReport(settings.userId, "scheduled", false);
      await db.finishWeeklyReportRun(run.id, { status: "succeeded", reportId: result.report.id });
      return res.json({ ok: true, reportId: result.report.id, created: result.created, runId: run.id });
    } catch (error) {
      await db.finishWeeklyReportRun(run.id, { status: "failed", error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[WeeklyReportSchedule] failed", error);
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}
