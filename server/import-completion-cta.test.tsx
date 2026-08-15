/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportCompletionCta } from "../client/src/components/ImportCompletionCta";
import { getImportCompletionState } from "../client/src/lib/import-flow";

describe("ImportCompletionCta", () => {
  it("does not render before a successful import", () => {
    render(<ImportCompletionCta completion={null} onNavigate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "分析を見る" })).toBeNull();
  });

  it("renders the CTA and navigates to analysis after import", () => {
    const onNavigate = vi.fn();
    render(<ImportCompletionCta completion={getImportCompletionState(2)} onNavigate={onNavigate} />);

    expect(screen.getByText("2件の実績を取り込みました")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "分析を見る" }));
    expect(onNavigate).toHaveBeenCalledWith("/analysis");
  });
});
