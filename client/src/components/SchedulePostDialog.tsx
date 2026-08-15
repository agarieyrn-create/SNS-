import React, { useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function SchedulePostDialog({ open, onOpenChange, draft }: { open: boolean; onOpenChange: (open: boolean) => void; draft: { id: number; content: string } | null }) {
  const utils = trpc.useUtils();
  const [content, setContent] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  useEffect(() => {
    if (!open || !draft) return;
    setContent(draft.content);
    setScheduledFor(localDateTimeValue(new Date(Date.now() + 15 * 60_000)));
  }, [draft, open]);
  const create = trpc.growth.scheduledPosts.create.useMutation({ onSuccess: post => { utils.growth.scheduledPosts.list.invalidate(); toast.success(`${new Date(post.scheduledFor).toLocaleString("ja-JP")} にXへ投稿予約しました。`); onOpenChange(false); }, onError: error => toast.error(error.message) });
  const charCount = Array.from(content).length;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl rounded-2xl"><DialogHeader><p className="eyebrow">X scheduled post</p><DialogTitle className="editorial-title text-2xl">Xへの投稿を予約する</DialogTitle><DialogDescription>指定日時に、登録済みのXアカウントへ自動投稿します。送信前に設定画面でX接続テストを完了してください。</DialogDescription></DialogHeader><div className="grid gap-5 py-3"><div><Label className="text-xs">投稿内容（280文字以内）</Label><Textarea value={content} onChange={event => setContent(event.target.value)} rows={7} className="mt-2 resize-none" /><p className={charCount > 280 ? "mt-1 text-right text-[11px] text-destructive" : "mt-1 text-right text-[11px] text-muted-foreground"}>{charCount}/280文字</p></div><div><Label className="text-xs">投稿日時（日本時間）</Label><Input type="datetime-local" value={scheduledFor} min={localDateTimeValue(new Date(Date.now() + 60_000))} onChange={event => setScheduledFor(event.target.value)} className="mt-2" /></div></div><DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>キャンセル</Button><Button type="button" onClick={() => create.mutate({ draftId: draft?.id ?? null, content, scheduledFor: new Date(scheduledFor), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo" })} disabled={!draft || !content.trim() || charCount > 280 || !scheduledFor || create.isPending} className="rounded-xl">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}投稿を予約</Button></DialogFooter></DialogContent></Dialog>;
}
