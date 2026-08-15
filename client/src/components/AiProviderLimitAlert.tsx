import { getAiUsageLimitStatus, type AiUsageLimitSnapshot } from "@/lib/ai-usage-limit";
import { AlertTriangle } from "lucide-react";
import React from "react";

export function AiProviderLimitAlert({ snapshot }: { snapshot: AiUsageLimitSnapshot }) {
  const status = getAiUsageLimitStatus(snapshot);
  if (!status.blocked) return null;
  return <div role="alert" className="mt-3 flex gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-2.5 text-[11px] leading-relaxed text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{status.reason}</div>;
}
