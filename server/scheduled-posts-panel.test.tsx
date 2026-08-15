/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const invalidate = vi.fn();
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ growth: { scheduledPosts: { list: { invalidate }, runs: { invalidate } } } }),
    growth: {
      scheduledPosts: {
        list: { useQuery: () => ({ data: [{ id: 71, content: "再試行済みの予約投稿", scheduledFor: new Date("2026-08-20T09:00:00.000Z"), timezone: "Asia/Tokyo", status: "published", xPostId: "x-retry-71", lastError: null }], isLoading: false }) },
        runs: { useQuery: () => ({ data: [{ id: 81, scheduledPostId: 71, trigger: "retry", status: "succeeded", startedAt: new Date("2026-08-20T09:01:00.000Z") }], isLoading: false }) },
        cancel: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        retry: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
  },
}));

import { ScheduledPostsPanel } from "../client/src/components/ScheduledPostsPanel";

describe("ScheduledPostsPanel", () => {
  afterEach(() => cleanup());

  it("labels the latest retry execution separately from a regular scheduled execution", () => {
    render(<ScheduledPostsPanel />);
    expect(screen.getByText(/実行履歴：再試行・送信成功/)).toBeTruthy();
  });
});
