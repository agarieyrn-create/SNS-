import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { COOKIE_NAME } from "../../shared/const";
import * as db from "../db";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { protectedProcedure, router } from "../_core/trpc";
import { generateWeeklyReport } from "../weekly-report";

// 6-field cron / UTC: Monday 00:00 = Monday 09:00 JST.
export const WEEKLY_REPORT_CRON = "0 0 0 * * 1";
const WEEKLY_REPORT_PATH = "/api/scheduled/weekly-report";

function getSessionToken(cookieHeader: string | undefined) {
  const token = parseCookie(cookieHeader ?? "")[COOKIE_NAME];
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "スケジュールの設定には有効なログインセッションが必要です。" });
  return token;
}

export const weeklyReportsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listWeeklyReports(ctx.user.id)),
  generate: protectedProcedure.mutation(({ ctx }) => generateWeeklyReport(ctx.user.id, "manual", true)),
  schedule: protectedProcedure.input(z.object({ enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const settings = await db.getGrowthSettings(ctx.user.id);
    const sessionToken = getSessionToken(ctx.req.headers.cookie);
    if (!input.enabled) {
      if (settings.weeklyReportCronTaskUid) await updateHeartbeatJob(settings.weeklyReportCronTaskUid, { enable: false }, sessionToken);
      return db.updateWeeklyReportSchedule(ctx.user.id, { weeklyReportEnabled: false });
    }
    let taskUid: string | null = settings.weeklyReportCronTaskUid;
    let nextExecutionAt: string | null | undefined;
    if (taskUid) {
      const updated = await updateHeartbeatJob(taskUid, { cron: WEEKLY_REPORT_CRON, path: WEEKLY_REPORT_PATH, enable: true, description: "SNS Growth Copilot週次分析レポート（毎週月曜09:00 JST）" }, sessionToken);
      nextExecutionAt = updated.nextExecutionAt;
    } else {
      const created = await createHeartbeatJob({ name: `sns-weekly-report-${ctx.user.id}`, cron: WEEKLY_REPORT_CRON, path: WEEKLY_REPORT_PATH, payload: { type: "weekly-report" }, description: "SNS Growth Copilot週次分析レポート（毎週月曜09:00 JST）" }, sessionToken);
      taskUid = created.taskUid;
      nextExecutionAt = created.nextExecutionAt;
    }
    if (!taskUid) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "週次レポートのスケジュールIDを保存できませんでした。" });
    const saved = await db.updateWeeklyReportSchedule(ctx.user.id, { weeklyReportEnabled: true, weeklyReportCronTaskUid: taskUid });
    return { settings: saved, nextExecutionAt: nextExecutionAt ?? null };
  }),
});
