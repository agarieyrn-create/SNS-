export type ImportedResult = { ideaId: null; draftId: null; title: string; category: string; postUrl: string | null; postedAt: Date; impressions: number; engagements: number; likes: number; replies: number; reposts: number; bookmarks: number; clicks: number; notes: string | null };
export type CsvImportIssue = { row: number; message: string };

export function parseCsvLine(line: string) {
  const cells: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { cells.push(current.trim()); current = ""; }
    else current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseResultImportCsv(text: string) {
  const sourceRows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (sourceRows.length < 2) return { rows: [] as ImportedResult[], skipped: 0, issues: [{ row: 1, message: "ヘッダー行と少なくとも1件のデータ行が必要です。" }] as CsvImportIssue[], mappings: [] as string[] };
  const headers = parseCsvLine(sourceRows[0]).map(header => header.trim().toLowerCase());
  const aliases: Record<string, string[]> = { title: ["title", "投稿", "投稿タイトル"], postedAt: ["postedat", "投稿日", "投稿日時"], category: ["category", "カテゴリ"], postUrl: ["posturl", "url", "投稿url"], impressions: ["impressions", "インプレッション"], engagements: ["engagements", "エンゲージメント"], likes: ["likes", "いいね"], replies: ["replies", "返信"], reposts: ["reposts", "リポスト"], bookmarks: ["bookmarks", "ブックマーク"], clicks: ["clicks", "クリック"], notes: ["notes", "メモ"] };
  const headerFor = (key: string) => aliases[key].find(alias => headers.includes(alias));
  const mappings = ["title", "postedAt", "category", "postUrl", "impressions", "engagements"].flatMap(key => { const header = headerFor(key); return header ? [`${key} ← ${header}`] : []; });
  const missing = ["title", "postedAt"].filter(key => !headerFor(key));
  if (missing.length) return { rows: [] as ImportedResult[], skipped: sourceRows.length - 1, issues: [{ row: 1, message: `必須列が見つかりません: ${missing.join("、")}` }], mappings };
  const column = (values: string[], key: string) => { const header = headerFor(key); return header ? values[headers.indexOf(header)]?.trim() ?? "" : ""; };
  const toNumber = (value: string) => Math.max(0, Number.parseInt(value.replaceAll(",", ""), 10) || 0);
  const rows: ImportedResult[] = []; const issues: CsvImportIssue[] = [];
  sourceRows.slice(1).forEach((line, index) => {
    const row = index + 2; const values = parseCsvLine(line); const title = column(values, "title"); const postedAt = new Date(column(values, "postedAt"));
    if (!title) { issues.push({ row, message: "投稿タイトルが空です。" }); return; }
    if (Number.isNaN(postedAt.getTime())) { issues.push({ row, message: "投稿日時を読み取れません。" }); return; }
    rows.push({ ideaId: null, draftId: null, title, category: column(values, "category") || "未分類", postUrl: column(values, "postUrl") || null, postedAt, impressions: toNumber(column(values, "impressions")), engagements: toNumber(column(values, "engagements")), likes: toNumber(column(values, "likes")), replies: toNumber(column(values, "replies")), reposts: toNumber(column(values, "reposts")), bookmarks: toNumber(column(values, "bookmarks")), clicks: toNumber(column(values, "clicks")), notes: column(values, "notes") || null });
  });
  return { rows, skipped: issues.length, issues, mappings };
}
