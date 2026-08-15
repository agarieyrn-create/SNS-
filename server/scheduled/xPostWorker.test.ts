import { describe, expect, it, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  getGrowthSettingsByXScheduledPostCronTaskUid: vi.fn(), listDueScheduledPosts: vi.fn(), startScheduledPostPublishing: vi.fn(), createScheduledPostRun: vi.fn(), getXAccountConnection: vi.fn(), markScheduledPostPublished: vi.fn(), markScheduledPostFailed: vi.fn(), finishScheduledPostRun: vi.fn(),
}));
const sdk = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
const xClient = vi.hoisted(() => ({ createXPost: vi.fn() }));
vi.mock("../db", () => db);
vi.mock("../_core/sdk", () => ({ sdk }));
vi.mock("../x-client", () => xClient);
import { runXPostWorkerSchedule } from "./xPostWorker";

function response() { const res = { json: vi.fn(), status: vi.fn() }; res.status.mockReturnValue(res); return res; }

describe("X予約投稿ワーカー", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-x" });
    db.getGrowthSettingsByXScheduledPostCronTaskUid.mockResolvedValue({ userId: 7 });
  });

  it("期限到達した予約を一度だけXへ送信し、成功履歴を記録する", async () => {
    db.listDueScheduledPosts.mockResolvedValue([{ id: 21, content: "予約投稿" }]);
    db.startScheduledPostPublishing.mockResolvedValue({ acquired: true, post: { id: 21 } });
    db.createScheduledPostRun.mockResolvedValue({ id: 88 });
    db.getXAccountConnection.mockResolvedValue({ id: 3 });
    xClient.createXPost.mockResolvedValue({ id: "x-post-1" });
    const res = response();
    await runXPostWorkerSchedule({} as any, res as any);
    expect(db.listDueScheduledPosts).toHaveBeenCalledWith(7);
    expect(db.createScheduledPostRun).toHaveBeenCalledWith(7, { scheduledPostId: 21, taskUid: "task-x", trigger: "scheduled" });
    expect(xClient.createXPost).toHaveBeenCalledWith({ id: 3 }, "予約投稿");
    expect(db.markScheduledPostPublished).toHaveBeenCalledWith(21, "x-post-1");
    expect(db.finishScheduledPostRun).toHaveBeenCalledWith(88, { status: "succeeded", xPostId: "x-post-1" });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, processed: [{ id: 21, status: "published" }] }));
  });

  it("X送信が失敗した場合に失敗理由と実行履歴を残し、他の投稿を巻き込まない", async () => {
    db.listDueScheduledPosts.mockResolvedValue([{ id: 22, content: "失敗予定" }]);
    db.startScheduledPostPublishing.mockResolvedValue({ acquired: true, post: { id: 22 } });
    db.createScheduledPostRun.mockResolvedValue({ id: 89 });
    db.getXAccountConnection.mockResolvedValue({ id: 3 });
    xClient.createXPost.mockRejectedValue(new Error("権限がありません"));
    const res = response();
    await runXPostWorkerSchedule({} as any, res as any);
    expect(db.markScheduledPostFailed).toHaveBeenCalledWith(22, "権限がありません");
    expect(db.finishScheduledPostRun).toHaveBeenCalledWith(89, { status: "failed", error: "権限がありません" });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, processed: [{ id: 22, status: "failed" }] }));
  });

  it("再試行された予約は実行履歴へretryトリガーとして記録する", async () => {
    db.listDueScheduledPosts.mockResolvedValue([{ id: 24, content: "再試行予定" }]);
    db.startScheduledPostPublishing.mockResolvedValue({ acquired: true, post: { id: 24, nextAttemptTrigger: "retry" } });
    db.createScheduledPostRun.mockResolvedValue({ id: 90 });
    db.getXAccountConnection.mockResolvedValue({ id: 3 });
    xClient.createXPost.mockResolvedValue({ id: "x-post-retry" });
    const res = response();
    await runXPostWorkerSchedule({} as any, res as any);
    expect(db.createScheduledPostRun).toHaveBeenCalledWith(7, { scheduledPostId: 24, taskUid: "task-x", trigger: "retry" });
    expect(db.finishScheduledPostRun).toHaveBeenCalledWith(90, { status: "succeeded", xPostId: "x-post-retry" });
  });

  it("別のワーカーが取得済みの投稿を再送信しない", async () => {
    db.listDueScheduledPosts.mockResolvedValue([{ id: 23, content: "重複防止" }]);
    db.startScheduledPostPublishing.mockResolvedValue({ acquired: false, post: { id: 23 } });
    const res = response();
    await runXPostWorkerSchedule({} as any, res as any);
    expect(xClient.createXPost).not.toHaveBeenCalled();
    expect(db.createScheduledPostRun).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ processed: [{ id: 23, status: "skipped" }] }));
  });
});
