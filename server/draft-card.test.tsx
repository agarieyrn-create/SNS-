/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { success, error } = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error } }));
import { DraftCard } from "../client/src/pages/GrowthCopilot";

const draft = { id: 10, content: "AIの学びを投稿に変える。", qualityScore: 86, charCount: 15, charLimit: 280, readabilityScore: 92, warnings: [], status: "generated" };
const props = { draft, onSave: vi.fn(), onRewrite: vi.fn(), onDelete: vi.fn(), onRecord: vi.fn(), saving: false, rewriting: false };

describe("DraftCard sharing actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    window.open = vi.fn();
  });
  afterEach(() => cleanup());

  it("copies the edited draft and shows a success notification", async () => {
    render(<DraftCard {...props} />);
    fireEvent.click(screen.getAllByRole("button", { name: "コピー" }).at(-1)!);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(draft.content));
    expect(success).toHaveBeenCalledWith(expect.stringContaining("投稿案をコピーしました"));
  });

  it("shows an error notification when clipboard writing fails", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("コピー失敗")) } });
    render(<DraftCard {...props} />);
    fireEvent.click(screen.getAllByRole("button", { name: "コピー" }).at(-1)!);
    await waitFor(() => expect(error).toHaveBeenCalledWith("コピー失敗"));
  });

  it("opens the X compose fallback when the native share sheet is unavailable", () => {
    render(<DraftCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "SNSで共有" }));
    expect(window.open).toHaveBeenCalledWith("https://x.com/intent/post?text=AI%E3%81%AE%E5%AD%A6%E3%81%B3%E3%82%92%E6%8A%95%E7%A8%BF%E3%81%AB%E5%A4%89%E3%81%88%E3%82%8B%E3%80%82", "_blank", "noopener,noreferrer");
  });
});
