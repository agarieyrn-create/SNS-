import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { calculateEngagementRate } from "./growth-utils";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type WeeklyRange = { start: Date; end: Date };

export function getPreviousJstWeekRange(reference = new Date()): WeeklyRange {
  const jst = new Date(reference.getTime() + JST_OFFSET_MS);
  const currentJstMidnight = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  const daysSinceMonday = (currentJstMidnight.getUTCDay() + 6) % 7;
  currentJstMidnight.setUTCDate(currentJstMidnight.getUTCDate() - daysSinceMonday);
  const end = new Date(currentJstMidnight.getTime() - JST_OFFSET_MS);
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

type ResultRow = { category: string; impressions: number; engagements: number };
type CategoryMetric = { category: string; posts: number; impressions: number; engagements: number; engagementRate: number };
type Insights = { headline: string; summary: string; wins: string[]; risks: string[]; actions: string[] };

function summarizeCategories(rows: ResultRow[]): CategoryMetric[] {
  const categories = new Map<string, Omit<CategoryMetric, "category" | "engagementRate">>();
  rows.forEach(row => {
    const current = categories.get(row.category) ?? { posts: 0, impressions: 0, engagements: 0 };
    current.posts += 1;
    current.impressions += row.impressions;
    current.engagements += row.engagements;
    categories.set(row.category, current);
  });
  return Array.from(categories.entries()).map(([category, data]) => ({ ...data, category, engagementRate: calculateEngagementRate(data.impressions, data.engagements) })).sort((a, b) => b.engagementRate - a.engagementRate);
}

function fallbackInsights(input: { postCount: number; impressions: number; engagementRate: number; topCategory?: CategoryMetric; settings: { impressionsTarget: number; engagementRateTargetBps: number } }): Insights {
  const engagementTarget = input.settings.engagementRateTargetBps / 100;
  const kpiText = input.impressions >= input.settings.impressionsTarget ? "インプレッション目標を達成しました。" : "インプレッション目標には改善余地があります。";
  return {
    headline: input.postCount ? `${input.postCount}件の投稿から、次の再現パターンを見つける週です。` : "今週は投稿実績が未登録です。次の検証の土台を作りましょう。",
    summary: `${kpiText} エンゲージメント率は${input.engagementRate.toFixed(2)}%です。`,
    wins: input.topCategory ? [`${input.topCategory.category} が最も高い反応率（${input.topCategory.engagementRate.toFixed(2)}%）でした。`] : ["投稿実績を記録すると、反応が高いテーマを特定できます。"],
    risks: [input.engagementRate >= engagementTarget ? "反応率は目標圏内です。再現性を確かめましょう。" : `反応率は目標 ${engagementTarget.toFixed(2)}% に届いていません。冒頭の具体性を見直しましょう。`],
    actions: input.topCategory ? [`次週は「${input.topCategory.category}」の切り口を1本以上再検証する。`, "投稿の冒頭に一次体験または具体的な変化を置く。", "投稿後24時間の数値を同じ条件で記録する。"] : ["来週の投稿テーマを一つ選び、ネタとして登録する。", "投稿後24時間の数値を記録する。", "異なるカテゴリで2本以上投稿し、比較できる状態を作る。"],
  };
}

async function writeInsights(input: { postCount: number; impressions: number; engagements: number; engagementRate: number; previousImpressions: number; previousEngagementRate: number; categories: CategoryMetric[]; settings: { impressionsTarget: number; engagementRateTargetBps: number } }): Promise<Insights> {
  const fallback = fallbackInsights({ ...input, topCategory: input.categories[0] });
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "あなたはSNS運用の週次分析を行う日本語の編集者です。与えられた数値だけを根拠にし、煽りや断定を避け、すぐ実行できる改善案を返します。" },
        { role: "user", content: JSON.stringify({
          currentWeek: { postCount: input.postCount, impressions: input.impressions, engagements: input.engagements, engagementRate: Number(input.engagementRate.toFixed(2)) },
          previousWeek: { impressions: input.previousImpressions, engagementRate: Number(input.previousEngagementRate.toFixed(2)) },
          kpi: { impressionsTarget: input.settings.impressionsTarget, engagementRateTarget: input.settings.engagementRateTargetBps / 100 },
          categories: input.categories.map(category => ({ ...category, engagementRate: Number(category.engagementRate.toFixed(2)) })),
          request: "週次レポート用に、見出し1件・要約1件・良かった点最大3件・注意点最大3件・次週の具体的アクション3件を日本語で作成してください。",
        }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "weekly_social_report",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" }, summary: { type: "string" }, wins: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } }, actions: { type: "array", items: { type: "string" } },
            },
            required: ["headline", "summary", "wins", "risks", "actions"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") return fallback;
    const parsed = JSON.parse(content) as Insights;
    if (!parsed.headline || !parsed.summary || !Array.isArray(parsed.wins) || !Array.isArray(parsed.risks) || !Array.isArray(parsed.actions)) return fallback;
    return { headline: parsed.headline, summary: parsed.summary, wins: parsed.wins.slice(0, 3), risks: parsed.risks.slice(0, 3), actions: parsed.actions.slice(0, 3) };
  } catch (error) {
    console.warn("[WeeklyReport] AI insight generation failed; using deterministic report.", error);
    return fallback;
  }
}

export async function generateWeeklyReport(userId: number, source: "manual" | "scheduled", force = false) {
  const { start, end } = getPreviousJstWeekRange();
  const existing = await db.getWeeklyReportByWeek(userId, start);
  if (existing && !force) return { report: existing, created: false };
  const previousStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [currentResults, previousResults, settings] = await Promise.all([
    db.listResultsInRange(userId, start, end), db.listResultsInRange(userId, previousStart, start), db.getGrowthSettings(userId),
  ]);
  const impressions = currentResults.reduce<number>((total, row) => total + row.impressions, 0);
  const engagements = currentResults.reduce<number>((total, row) => total + row.engagements, 0);
  const engagementRate = calculateEngagementRate(impressions, engagements);
  const previousImpressions = previousResults.reduce<number>((total, row) => total + row.impressions, 0);
  const previousEngagements = previousResults.reduce<number>((total, row) => total + row.engagements, 0);
  const previousEngagementRate = calculateEngagementRate(previousImpressions, previousEngagements);
  const categories = summarizeCategories(currentResults);
  const insights = await writeInsights({ postCount: currentResults.length, impressions, engagements, engagementRate, previousImpressions, previousEngagementRate, categories, settings });
  const report = await db.saveWeeklyReport(userId, {
    weekStart: start, weekEnd: end, source, postCount: currentResults.length, impressions, engagements, engagementRateBps: Math.round(engagementRate * 100),
    impressionChangePct: previousImpressions ? Math.round(((impressions - previousImpressions) / previousImpressions) * 100) : null,
    engagementRateChangeBps: Math.round((engagementRate - previousEngagementRate) * 100), categoryBreakdown: categories, insights,
  });
  await db.updateWeeklyReportSchedule(userId, { weeklyReportLastGeneratedAt: new Date() });
  return { report, created: !existing };
}
