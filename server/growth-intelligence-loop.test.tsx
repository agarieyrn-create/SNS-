/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GrowthIntelligenceLoop } from "../client/src/components/GrowthIntelligenceLoop";

describe("GrowthIntelligenceLoop", () => {
  afterEach(() => cleanup());

  it("shows the four-step SNS growth cycle and sends the user to the selected workspace", () => {
    const onNavigate = vi.fn();
    render(<GrowthIntelligenceLoop onNavigate={onNavigate} />);

    expect(screen.getByText("CAPTURE → LEARN")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /投稿案/ }));
    expect(onNavigate).toHaveBeenCalledWith("/drafts");
  });
});
