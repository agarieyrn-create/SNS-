import { describe, expect, it } from "vitest";
import { getImportCompletionState } from "../client/src/lib/import-flow";

describe("getImportCompletionState", () => {
  it("does not show a completion CTA before a successful import", () => {
    expect(getImportCompletionState(0)).toBeNull();
    expect(getImportCompletionState(-1)).toBeNull();
  });

  it("shows an analysis CTA after rows are imported", () => {
    expect(getImportCompletionState(3)).toEqual({
      title: "3件の実績を取り込みました",
      description: "カテゴリ・到達・反応の変化を分析画面で確認できます。",
      targetPath: "/analysis",
    });
  });
});
