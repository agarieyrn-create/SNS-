/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AiProviderLimitAlert } from "../client/src/components/AiProviderLimitAlert";

describe("AiProviderLimitAlert", () => {
  const base = { monthlyRequestCount: 2, monthlyRequestLimit: 10, monthlyCostMilliUsd: 250, monthlyBudgetMilliUsd: 1000, perRequestReservationMilliUsd: 50 };

  afterEach(() => cleanup());

  it("does not render an alert while the provider remains within both monthly limits", () => {
    render(<AiProviderLimitAlert snapshot={base} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders a stop reason when the monthly request cap is reached", () => {
    render(<AiProviderLimitAlert snapshot={{ ...base, monthlyRequestCount: 10 }} />);
    expect(screen.getByRole("alert").textContent).toContain("月間利用回数の上限");
  });

  it("renders a stop reason before the next request would exceed the monthly budget", () => {
    render(<AiProviderLimitAlert snapshot={{ ...base, monthlyCostMilliUsd: 980 }} />);
    expect(screen.getByRole("alert").textContent).toContain("月額上限");
  });
});
