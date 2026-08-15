import { describe, expect, it } from "vitest";
import { parseResultImportCsv } from "../client/src/lib/result-import";

describe("parseResultImportCsv", () => {
  it("maps Japanese headers and reports invalid rows", () => {
    const result = parseResultImportCsv("投稿タイトル,投稿日,インプレッション,エンゲージメント\n朝の投稿,2026-08-15T09:00:00,1200,48\n,invalid,0,0");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ title: "朝の投稿", impressions: 1200, engagements: 48 });
    expect(result.issues).toEqual([{ row: 3, message: "投稿タイトルが空です。" }]);
    expect(result.mappings).toContain("title ← 投稿タイトル");
  });

  it("rejects files that do not contain required headers", () => {
    const result = parseResultImportCsv("カテゴリ,表示数\nAI,100");
    expect(result.rows).toEqual([]);
    expect(result.issues[0]?.message).toContain("必須列が見つかりません");
  });
});
