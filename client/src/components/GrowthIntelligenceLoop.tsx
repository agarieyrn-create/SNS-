import { ArrowRight, ClipboardPenLine, Lightbulb, LineChart, Sparkles } from "lucide-react";
import React from "react";

const steps = [
  { label: "CAPTURE", title: "ネタ", icon: Lightbulb, path: "/ideas", tone: "bg-[#e6f0e3] text-[#558151]" },
  { label: "COMPOSE", title: "投稿案", icon: Sparkles, path: "/drafts", tone: "bg-[#e2edf6] text-[#49657e]" },
  { label: "MEASURE", title: "実績", icon: ClipboardPenLine, path: "/results", tone: "bg-[#f7edd8] text-[#ad7c30]" },
  { label: "LEARN", title: "分析", icon: LineChart, path: "/analysis", tone: "bg-[#efe9f2] text-[#8e6b97]" },
];

export function GrowthIntelligenceLoop({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <section className="relative mt-7 overflow-hidden rounded-2xl border border-[#d7c38f]/55 bg-[linear-gradient(120deg,#fdfbf5_0%,#f5f0e4_58%,#edf4f8_100%)] p-5 sm:p-6"><div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border-[18px] border-[#d9b761]/15" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow text-[#a87828]">Growth intelligence loop</p><h2 className="mt-1 text-lg font-bold text-[#15273a]">記録が、次の一案を賢くする。</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">一つの投稿を終わらせず、反応を学びに変えて次の発信へ戻します。</p></div><span className="mono w-fit rounded-full bg-[#15273a] px-3 py-1 text-[10px] text-[#e6c875]">CAPTURE → LEARN</span></div><div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{steps.map((step, index) => { const Icon = step.icon; return <React.Fragment key={step.path}><button onClick={() => onNavigate(step.path)} className="group rounded-xl border border-white/80 bg-white/70 p-3 text-left shadow-[0_8px_20px_-18px_rgba(20,39,58,.55)] transition hover:-translate-y-0.5 hover:bg-white"><div className="flex items-center justify-between"><span className={`grid h-8 w-8 place-items-center rounded-lg ${step.tone}`}><Icon className="h-4 w-4" /></span><span className="mono text-[9px] text-muted-foreground">0{index + 1}</span></div><p className="mono mt-3 text-[9px] tracking-wider text-muted-foreground">{step.label}</p><p className="mt-1 text-sm font-bold text-[#15273a]">{step.title}</p></button>{index < steps.length - 1 ? <ArrowRight className="pointer-events-none absolute -right-[15px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-[#b18138] sm:block" style={{ left: `${(index + 1) * 25 - 2}%` }} /> : null}</React.Fragment>; })}</div></section>;
}
