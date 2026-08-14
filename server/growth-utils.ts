export type QualityReview = {
  charCount: number;
  readabilityScore: number;
  qualityScore: number;
  warnings: string[];
};

export function reviewPost(content: string, charLimit: number, bannedWords: string[] = []): QualityReview {
  const normalized = content.trim();
  const charCount = Array.from(normalized).length;
  const warnings: string[] = [];
  const sentences = normalized.split(/[。！？!?\n]+/).filter(Boolean);
  const averageSentenceLength = sentences.length ? charCount / sentences.length : charCount;
  const matchedBannedWords = bannedWords.filter(word => word.trim() && normalized.includes(word.trim()));

  if (!normalized) warnings.push("本文が入力されていません。");
  if (charCount > charLimit) warnings.push(`文字数が指定上限を${charCount - charLimit}字超えています。`);
  if (matchedBannedWords.length) warnings.push(`禁止ワードを検出しました: ${matchedBannedWords.join("、")}`);
  if (averageSentenceLength > 48) warnings.push("一文が長めです。改行や句点で区切ると読みやすくなります。");
  if (charCount < 35) warnings.push("情報量が少なめです。具体例や気づきを加えることを検討してください。");
  if (!/[\n。！？!?]/.test(normalized)) warnings.push("区切りが少ないため、読みやすさを確認してください。");

  const readabilityScore = Math.max(0, Math.min(100, Math.round(
    100 - Math.max(0, averageSentenceLength - 24) * 1.3 - (charCount > charLimit ? 18 : 0) - (matchedBannedWords.length * 22),
  )));
  const qualityScore = Math.max(0, Math.min(100, Math.round(
    readabilityScore - (charCount < 35 ? 16 : 0) - (normalized.startsWith("私は") ? 2 : 0),
  )));

  return { charCount, readabilityScore, qualityScore, warnings };
}

export function calculateEngagementRate(impressions: number, engagements: number) {
  return impressions > 0 ? (engagements / impressions) * 100 : 0;
}

export function makeTrend(rows: Array<{ postedAt: Date; impressions: number; engagements: number }>) {
  const buckets = new Map<string, { label: string; impressions: number; engagements: number }>();
  const today = new Date();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, { label: `${date.getMonth() + 1}/${date.getDate()}`, impressions: 0, engagements: 0 });
  }
  rows.forEach(row => {
    const key = new Date(row.postedAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.impressions += row.impressions;
      bucket.engagements += row.engagements;
    }
  });
  return Array.from(buckets.values());
}
