/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const listQuery = vi.fn();

vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ growth: { aiConnections: { list: { invalidate: vi.fn() } } } }),
    growth: {
      aiConnections: {
        list: { useQuery: () => listQuery() },
        save: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        reorder: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
  },
}));

import { AiProviderSettings } from "../client/src/components/AiProviderSettings";

const defaults = [
  { provider: "openai", label: "OpenAI", defaultModel: "gpt-5-mini" },
  { provider: "anthropic", label: "Claude", defaultModel: "claude-sonnet-4-6" },
  { provider: "gemini", label: "Gemini", defaultModel: "gemini-3.6-flash" },
  { provider: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-5-mini" },
];

function makeProvider(overrides: Record<string, unknown> = {}) {
  return { provider: "openai", model: "gpt-5-mini", enabled: true, priority: 1, registered: true, monthlyRequestLimit: 10, monthlyBudgetMilliUsd: 1000, perRequestReservationMilliUsd: 50, monthlyRequestCount: 2, monthlyCostMilliUsd: 250, ...overrides };
}

describe("AiProviderSettings monthly limit display", () => {
  afterEach(() => cleanup());

  it("renders the request-limit stop alert in the complete settings component", () => {
    listQuery.mockReturnValue({ data: { providers: [makeProvider({ monthlyRequestCount: 10 })], defaults }, isLoading: false });
    render(<AiProviderSettings />);
    expect(screen.getByRole("alert").textContent).toContain("月間利用回数の上限");
  });

  it("renders the budget-limit stop alert in the complete settings component", () => {
    listQuery.mockReturnValue({ data: { providers: [makeProvider({ monthlyCostMilliUsd: 980 })], defaults }, isLoading: false });
    render(<AiProviderSettings />);
    expect(screen.getByRole("alert").textContent).toContain("月額上限");
  });
});
