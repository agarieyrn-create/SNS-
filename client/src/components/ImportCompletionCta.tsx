import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImportCompletionState } from "@/lib/import-flow";

type ImportCompletionCtaProps = {
  completion: ImportCompletionState | null;
  onNavigate: (targetPath: "/analysis") => void;
};

export function ImportCompletionCta({ completion, onNavigate }: ImportCompletionCtaProps) {
  if (!completion) return null;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#cfe1ca] bg-[#f2f8f0] p-4 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="text-sm font-bold text-[#3f6d3b]">{completion.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{completion.description}</p>
      </div>
      <Button onClick={() => onNavigate(completion.targetPath)} variant="outline" className="rounded-lg border-[#9ec298] bg-white text-[#3f6d3b]">
        分析を見る <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
