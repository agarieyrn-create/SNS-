import { describe, expect, it } from "vitest";
import { calculateEngagementRate, reviewPost } from "./growth-utils";

describe("reviewPost", () => {
  it("counts Japanese characters and detects prohibited language", () => {
    const review = reviewPost("これは絶対に使わないでください。", 280, ["絶対"]);
    expect(review.charCount).toBeGreaterThan(0);
    expect(review.warnings.join(" ")).toContain("禁止ワード");
    expect(review.qualityScore).toBeLessThan(80);
  });

  it("warns when content exceeds the requested limit", () => {
    const review = reviewPost("あ".repeat(81), 80, []);
    expect(review.warnings.join(" ")).toContain("上限を1字超えています");
  });
});

describe("calculateEngagementRate", () => {
  it("calculates a percentage and handles an empty reach safely", () => {
    expect(calculateEngagementRate(1000, 35)).toBeCloseTo(3.5);
    expect(calculateEngagementRate(0, 35)).toBe(0);
  });
});

