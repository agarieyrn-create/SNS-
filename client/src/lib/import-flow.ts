export type ImportCompletionState = {
  title: string;
  description: string;
  targetPath: "/analysis";
};

/**
 * Returns the success state shown after a valid CSV import.
 * Keeping this rule pure makes the UI state easy to test independently.
 */
export function getImportCompletionState(importedCount: number): ImportCompletionState | null {
  if (!Number.isFinite(importedCount) || importedCount <= 0) return null;

  return {
    title: `${Math.floor(importedCount)}件の実績を取り込みました`,
    description: "カテゴリ・到達・反応の変化を分析画面で確認できます。",
    targetPath: "/analysis",
  };
}
