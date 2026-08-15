import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, Check, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Provider = "openai" | "anthropic" | "gemini" | "openrouter";
const providerInfo: Record<Provider, { name: string; modelHint: string; description: string }> = {
  openai: { name: "OpenAI", modelHint: "例：gpt-5-mini", description: "OpenAI Platformで発行したAPIキーを使います。" },
  anthropic: { name: "Claude", modelHint: "例：claude-sonnet-4-6", description: "Anthropic Consoleで発行したAPIキーを使います。" },
  gemini: { name: "Gemini", modelHint: "例：gemini-3.6-flash", description: "Google AI Studioで発行したGemini APIキーを使います。" },
  openrouter: { name: "OpenRouter", modelHint: "例：openai/gpt-5-mini", description: "OpenRouterで利用可能なモデルIDを指定できます。" },
};

export function AiProviderSettings() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const connections = trpc.growth.aiConnections.list.useQuery(undefined, { enabled: isAuthenticated });
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!connections.data) return;
    setModels(Object.fromEntries(connections.data.providers.map(item => [item.provider, item.model || connections.data.defaults.find(defaults => defaults.provider === item.provider)?.defaultModel || ""])));
    setEnabled(Object.fromEntries(connections.data.providers.map(item => [item.provider, item.enabled])));
  }, [connections.data]);

  const save = trpc.growth.aiConnections.save.useMutation({
    onSuccess: (_, variables) => {
      utils.growth.aiConnections.list.invalidate();
      setApiKeys(current => ({ ...current, [variables.provider]: "" }));
      toast.success(`${providerInfo[variables.provider].name}の接続設定を保存しました。`);
    },
    onError: error => toast.error(error.message),
  });
  const reorder = trpc.growth.aiConnections.reorder.useMutation({ onSuccess: () => { utils.growth.aiConnections.list.invalidate(); toast.success("AIの優先順位を更新しました。"); }, onError: error => toast.error(error.message) });
  const remove = trpc.growth.aiConnections.delete.useMutation({ onSuccess: () => { utils.growth.aiConnections.list.invalidate(); toast.success("AI接続を削除しました。"); }, onError: error => toast.error(error.message) });

  const registered = useMemo(() => (connections.data?.providers ?? []).filter(item => item.registered).sort((left, right) => left.priority - right.priority), [connections.data]);
  const move = (provider: Provider, direction: -1 | 1) => {
    const index = registered.findIndex(item => item.provider === provider);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= registered.length) return;
    const reordered = [...registered];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorder.mutate({ priorities: reordered.map((item, priority) => ({ provider: item.provider, priority: priority + 1, enabled: enabled[item.provider] ?? item.enabled })) });
  };

  if (connections.isLoading) return <Card className="soft-card mt-6 rounded-2xl"><CardContent className="p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;

  return <Card className="soft-card mt-6 rounded-2xl"><CardContent className="p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">AI connections</p><h2 className="mt-1 text-lg font-bold">AI接続と優先順位</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">APIキーは画面に再表示せず、サーバー側で暗号化して保存します。有効な接続を上から順に試し、失敗時は次の接続へ切り替えます。</p></div><Badge className="w-fit rounded-full border-0 bg-[#e2edf6] px-3 py-1 text-[10px] text-[#49657e]">投稿案・AI改善に適用</Badge></div>
    <div className="mt-5 rounded-xl border border-[#ecd8ae] bg-[#fcf8ed] p-3 text-xs leading-relaxed text-[#745b2a]"><strong>ChatGPTサブスクはAPIキーではありません。</strong> OpenAIを使う場合はOpenAI PlatformのAPIキーが必要です。Claude、Gemini、OpenRouterもそれぞれのAPIキーを登録してください。</div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">{(connections.data?.providers ?? []).map(item => {
      const provider = item.provider as Provider; const info = providerInfo[provider]; const priority = registered.findIndex(registeredItem => registeredItem.provider === provider) + 1;
      return <div key={provider} className="rounded-2xl border border-border/70 bg-card/70 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-sm font-bold">{info.name}</h3>{item.registered ? <Badge className="rounded-full border-0 bg-[#e6f0e3] px-2 py-0.5 text-[10px] text-[#558151]">登録済み</Badge> : <Badge variant="outline" className="rounded-full bg-card px-2 py-0.5 text-[10px]">未登録</Badge>}</div><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{info.description}</p></div>{item.registered ? <div className="flex items-center gap-1"><Button type="button" size="icon" variant="ghost" disabled={priority <= 1 || reorder.isPending} onClick={() => move(provider, -1)} aria-label={`${info.name}の優先順位を上げる`}><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" disabled={priority < 1 || priority >= registered.length || reorder.isPending} onClick={() => move(provider, 1)} aria-label={`${info.name}の優先順位を下げる`}><ArrowDown className="h-4 w-4" /></Button></div> : null}</div>
        <div className="mt-4 grid gap-3"><div><Label className="text-[11px]">モデル</Label><Input value={models[provider] ?? ""} onChange={event => setModels(current => ({ ...current, [provider]: event.target.value }))} placeholder={info.modelHint} className="mt-1" /></div><div><Label className="text-[11px]">APIキー {item.registered ? "（変更する場合のみ入力）" : "*"}</Label><div className="relative mt-1"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="password" autoComplete="off" value={apiKeys[provider] ?? ""} onChange={event => setApiKeys(current => ({ ...current, [provider]: event.target.value }))} placeholder={item.registered ? "暗号化して保存済み" : "APIキーを入力"} className="pl-9" /></div></div><label className="flex cursor-pointer items-center gap-2 text-xs font-medium"><input type="checkbox" checked={enabled[provider] ?? false} disabled={!item.registered && !(apiKeys[provider]?.trim())} onChange={event => setEnabled(current => ({ ...current, [provider]: event.target.checked }))} />この接続を有効にする</label></div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3"><span className="text-[10px] text-muted-foreground">{item.registered ? `優先順位 ${priority} / ${registered.length}` : "保存すると優先順位に追加されます"}</span><div className="flex gap-2">{item.registered ? <Button type="button" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (window.confirm(`${info.name}の接続を削除しますか？`)) remove.mutate({ provider }); }} disabled={remove.isPending}><Trash2 className="mr-1.5 h-3.5 w-3.5" />削除</Button> : null}<Button type="button" size="sm" onClick={() => save.mutate({ provider, apiKey: apiKeys[provider]?.trim() || undefined, model: models[provider] || info.modelHint.replace("例：", ""), enabled: enabled[provider] ?? Boolean(apiKeys[provider]?.trim()), priority: item.registered ? item.priority : registered.length + 1 })} disabled={save.isPending || !models[provider]?.trim() || (!item.registered && !apiKeys[provider]?.trim())}>{save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}{item.registered ? "更新" : "登録"}</Button></div></div>
      </div>;
    })}</div>
    <div className="mt-5 flex items-start gap-2 rounded-xl bg-secondary/55 p-3 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />登録したキーは画面に表示せず、各プロバイダーへの呼び出し時だけサーバー内で復号します。全接続を無効にした場合は、従来どおりアプリ内蔵AIを使います。</div>
  </CardContent></Card>;
}
