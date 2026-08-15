import { describe, expect, it } from "vitest";
import { getAiUsageLimitStatus } from "../client/src/lib/ai-usage-limit";

describe("AI usage limit status", () => {
  const base = { monthlyRequestCount: 3, monthlyRequestLimit: 10, monthlyCostMilliUsd: 250, monthlyBudgetMilliUsd: 1000, perRequestReservationMilliUsd: 50 };

  it("allows a provider below both monthly limits", () => {
    expect(getAiUsageLimitStatus(base)).toEqual({ blocked: false, reason: null });
  });

  it("shows a stop reason when the request limit has been reached", () => {
    expect(getAiUsageLimitStatus({ ...base, monthlyRequestCount: 10 }).reason).toContain("月間利用回数の上限");
  });

  it("shows a stop reason before the next reserved request would exceed the budget", () => {
    expect(getAiUsageLimitStatus({ ...base, monthlyCostMilliUsd: 980 }).reason).toContain("月額上限");
  });
});
