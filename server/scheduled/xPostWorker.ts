import type { Request, Response } from "express";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import { createXPost } from "../x-client";

export async function runXPostWorkerSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const settings = await db.getGrowthSettingsByXScheduledPostCronTaskUid(user.taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    const posts = await db.listDueScheduledPosts(settings.userId);
    const outcomes: Array<{ id: number; status: "published" | "failed" | "skipped" }> = [];
    for (const scheduledPost of posts) {
      const acquired = await db.startScheduledPostPublishing(scheduledPost.id);
      if (!acquired.acquired) {
        outcomes.push({ id: scheduledPost.id, status: "skipped" });
        continue;
      }
      const trigger = acquired.post?.nextAttemptTrigger === "retry" ? "retry" : "scheduled";
      const run = await db.createScheduledPostRun(settings.userId, { scheduledPostId: scheduledPost.id, taskUid: user.taskUid, trigger });
      try {
        const connection = await db.getXAccountConnection(settings.userId);
        if (!connection) throw new Error("Xの認証情報が未登録です。設定画面で再登録してください。");
        const result = await createXPost(connection, scheduledPost.content);
        await db.markScheduledPostPublished(scheduledPost.id, result.id);
        await db.finishScheduledPostRun(run.id, { status: "succeeded", xPostId: result.id });
        outcomes.push({ id: scheduledPost.id, status: "published" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Xへの予約投稿に失敗しました。";
        await db.markScheduledPostFailed(scheduledPost.id, message.slice(0, 1000));
        await db.finishScheduledPostRun(run.id, { status: "failed", error: message.slice(0, 1000) });
        outcomes.push({ id: scheduledPost.id, status: "failed" });
      }
    }
    return res.json({ ok: true, processed: outcomes });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[XPostWorker] failed", error);
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}
