import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptApiKey, encryptApiKey, generateWithProviderPriority } from "./ai-provider-gateway";

const input = { system: "JSONだけを返してください。", prompt: "投稿案を作成してください。" };

describe("AI provider gateway", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("encrypts API keys so they can be recovered only on the server", () => {
    const encrypted = encryptApiKey("sk-test-secret-value");
    expect(encrypted.encryptedApiKey).not.toContain("sk-test-secret-value");
    expect(decryptApiKey(encrypted)).toBe("sk-test-secret-value");
  });

  it("uses the built-in provider when no external connection is enabled", async () => {
    const builtIn = vi.fn().mockResolvedValue('{"posts":["内蔵AIの投稿案"]}');
    const result = await generateWithProviderPriority([], input, builtIn);
    expect(result).toEqual({ content: '{"posts":["内蔵AIの投稿案"]}', provider: "built_in", failures: [] });
    expect(builtIn).toHaveBeenCalledOnce();
  });

  it("falls through to the next configured provider after a connection failure", async () => {
    const first = { provider: "openai" as const, model: "gpt-5-mini", enabled: true, priority: 1, ...encryptApiKey("first-key") };
    const second = { provider: "openrouter" as const, model: "openai/gpt-5-mini", enabled: true, priority: 2, ...encryptApiKey("second-key") };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { message: "invalid key" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"posts":["フォールバック成功"]}' } }] }) }));

    const result = await generateWithProviderPriority([first, second], input, vi.fn());

    expect(result.provider).toBe("openrouter");
    expect(result.content).toContain("フォールバック成功");
    expect(result.failures).toHaveLength(1);
  });
});
