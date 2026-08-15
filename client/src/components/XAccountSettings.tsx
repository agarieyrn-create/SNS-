import React, { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, PlugZap, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyForm = { apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "" };

function formatTestedAt(value: Date | string | null) {
  return value ? new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "未テスト";
}

export function XAccountSettings() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const status = trpc.growth.xConnection.status.useQuery(undefined, { enabled: isAuthenticated });
  const [form, setForm] = useState(emptyForm);
  const refresh = () => utils.growth.xConnection.status.invalidate();
  const testConnection = trpc.growth.xConnection.test.useMutation({ onSuccess: result => { refresh(); toast.success(result.account.username ? `@${result.account.username} の接続を確認しました。` : "Xへの接続を確認しました。"); }, onError: error => { refresh(); toast.error(error.message); } });
  const save = trpc.growth.xConnection.save.useMutation({ onSuccess: () => { refresh(); setForm(emptyForm); toast.success("Xの認証情報を暗号化して保存しました。"); }, onError: error => toast.error(error.message) });
  const remove = trpc.growth.xConnection.delete.useMutation({ onSuccess: () => { refresh(); setForm(emptyForm); toast.success("Xの認証情報を削除しました。"); }, onError: error => toast.error(error.message) });
  const valuesChanged = Object.values(form).some(Boolean);

  if (status.isLoading && isAuthenticated) return <Card className="soft-card mt-6 rounded-2xl"><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />X接続設定を読み込んでいます。</CardContent></Card>;

  return <Card className="soft-card mt-6 rounded-2xl"><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">X scheduled posting</p><h2 className="mt-1 text-lg font-bold">X自動投稿の認証</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">本人のXアカウントへ予約投稿するための認証情報です。保存後は表示せず、サーバー側で暗号化して管理します。</p></div><Badge className={status.data?.registered ? "w-fit rounded-full border-0 bg-[#e6f0e3] text-[#558151]" : "w-fit rounded-full border-0 bg-secondary text-muted-foreground"}>{status.data?.registered ? "登録済み" : "未登録"}</Badge></div>
    <div className="mt-4 rounded-xl border border-[#ecd8ae] bg-[#fcf8ed] p-3 text-xs leading-relaxed text-[#745b2a]"><strong>必要な情報は4つです。</strong> X Developer Consoleの API Key、API Key Secret、Access Token、Access Token Secret を入力してください。Bearer Tokenだけでは投稿できません。</div>
    {status.data?.registered ? <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#cbd9e6] bg-[#f3f8fc] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-semibold text-[#304f6b]">接続診断：{formatTestedAt(status.data.lastTestedAt)}</p>{status.data.lastTestError ? <p className="mt-1 max-w-xl text-[10px] text-destructive">前回失敗：{status.data.lastTestError}</p> : status.data.lastTestedAt ? <p className="mt-1 flex items-center gap-1 text-[10px] text-[#558151]"><CheckCircle2 className="h-3 w-3" />前回の接続テストは成功しています。</p> : <p className="mt-1 text-[10px] text-muted-foreground">予約作成前に接続をテストしてください。</p>}</div><Button type="button" size="sm" variant="outline" onClick={() => testConnection.mutate()} disabled={testConnection.isPending} className="shrink-0 rounded-lg bg-card">{testConnection.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlugZap className="mr-1.5 h-3.5 w-3.5" />}接続をテスト</Button></div> : null}
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><XField label="API Key" value={form.apiKey} onChange={value => setForm(current => ({ ...current, apiKey: value }))} placeholder={status.data?.registered ? "変更する場合のみ入力" : "X API Key"} /><XField label="API Key Secret" value={form.apiSecret} onChange={value => setForm(current => ({ ...current, apiSecret: value }))} placeholder={status.data?.registered ? "変更する場合のみ入力" : "X API Key Secret"} /><XField label="Access Token" value={form.accessToken} onChange={value => setForm(current => ({ ...current, accessToken: value }))} placeholder={status.data?.registered ? "変更する場合のみ入力" : "Access Token"} /><XField label="Access Token Secret" value={form.accessTokenSecret} onChange={value => setForm(current => ({ ...current, accessTokenSecret: value }))} placeholder={status.data?.registered ? "変更する場合のみ入力" : "Access Token Secret"} /></div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4"><div className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />認証情報はブラウザへ再表示せず、接続テスト・予約投稿を実行する時だけサーバー内で復号します。</div><div className="flex flex-wrap gap-2">{status.data?.registered ? <Button type="button" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (window.confirm("Xの認証情報を削除しますか？予約済み投稿は送信できなくなります。")) remove.mutate(); }} disabled={remove.isPending}><Trash2 className="mr-1.5 h-3.5 w-3.5" />削除</Button> : null}<Button type="button" size="sm" onClick={() => save.mutate(valuesChanged ? form : {})} disabled={save.isPending || (!status.data?.registered && !Object.values(form).every(Boolean))}>{save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}{status.data?.registered ? "認証情報を更新" : "認証情報を登録"}</Button></div></div>
  </CardContent></Card>;
}

function XField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div><Label className="text-[11px]">{label}</Label><div className="relative mt-1"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="password" autoComplete="off" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="pl-9" /></div></div>;
}
