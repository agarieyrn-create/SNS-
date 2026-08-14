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
    if (!settings.weeklyReportEnabled) return res.json({ ok: true, skipped: "disabled" });
    const result = await generateWeeklyReport(settings.userId, "scheduled", false);
    return res.json({ ok: true, reportId: result.report.id, created: result.created });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[WeeklyReportSchedule] failed", error);
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}
