import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

export const AI_PROVIDERS = ["openai", "anthropic", "gemini", "openrouter"] as const;
export type AiProvider = typeof AI_PROVIDERS[number];

export const providerDefaults: Record<AiProvider, { label: string; defaultModel: string }> = {
  openai: { label: "OpenAI", defaultModel: "gpt-5-mini" },
  anthropic: { label: "Claude", defaultModel: "claude-sonnet-4-6" },
  gemini: { label: "Gemini", defaultModel: "gemini-3.6-flash" },
  openrouter: { label: "OpenRouter", defaultModel: "openai/gpt-5-mini" },
};

export type EncryptedApiKey = { encryptedApiKey: string; encryptionIv: string; encryptionTag: string };
export type ProviderConnectionForUse = EncryptedApiKey & { provider: AiProvider; model: string; enabled: boolean; priority: number };

function encryptionKey() {
  if (!ENV.cookieSecret) throw new Error("暗号化キーを初期化できません。サーバー設定を確認してください。");
  return createHash("sha256").update(`sns-growth-copilot:ai-provider:${ENV.cookieSecret}`).digest();
}

export function encryptApiKey(apiKey: string): EncryptedApiKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return { encryptedApiKey: encrypted.toString("base64"), encryptionIv: iv.toString("base64"), encryptionTag: cipher.getAuthTag().toString("base64") };
}

export function decryptApiKey(value: EncryptedApiKey) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.encryptionIv, "base64"));
  decipher.setAuthTag(Buffer.from(value.encryptionTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.encryptedApiKey, "base64")), decipher.final()]).toString("utf8");
}

type CompletionInput = { system: string; prompt: string };
export type ProviderGeneration = { content: string; inputTokens?: number; outputTokens?: number; actualCostMilliUsd?: number };
type UsageHooks<T extends ProviderConnectionForUse> = { reserve: (connection: T) => Promise<number>; success: (connection: T, recordId: number, result: ProviderGeneration) => Promise<void>; failure: (connection: T, recordId: number, error: Error) => Promise<void> };

async function requestJson(url: string, init: RequestInit, provider: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const error = typeof payload.error === "object" && payload.error ? payload.error as Record<string, unknown> : payload;
      const message = typeof error.message === "string" ? error.message : `HTTP ${response.status}`;
      throw new Error(`${provider}への接続に失敗しました: ${message.slice(0, 180)}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error(`${provider}からの応答がタイムアウトしました。`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getChatCompletionContent(payload: Record<string, unknown>, provider: string): ProviderGeneration {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const message = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>).message as Record<string, unknown> | undefined : undefined;
  const content = message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error(`${provider}から投稿案を取得できませんでした。`);
  const usage = payload.usage as Record<string, unknown> | undefined;
  const actualCost = typeof usage?.cost === "number" ? Math.max(0, Math.round(usage.cost * 1000)) : undefined;
  return { content: content.trim(), inputTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : undefined, outputTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : undefined, actualCostMilliUsd: actualCost };
}

async function generateOpenAiCompatible(url: string, apiKey: string, model: string, input: CompletionInput, provider: string, headers: Record<string, string> = {}) {
  const payload = await requestJson(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ model, messages: [{ role: "system", content: input.system }, { role: "user", content: `${input.prompt}\n\n出力はJSONのみで返してください。` }], response_format: { type: "json_object" } }),
  }, provider);
  return getChatCompletionContent(payload, provider);
}

async function generateAnthropic(apiKey: string, model: string, input: CompletionInput): Promise<ProviderGeneration> {
  const payload = await requestJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 2000, system: input.system, messages: [{ role: "user", content: `${input.prompt}\n\n出力はJSONのみで返してください。` }] }),
  }, "Claude");
  const blocks = Array.isArray(payload.content) ? payload.content : [];
  const text = blocks.find(block => block && typeof block === "object" && (block as Record<string, unknown>).type === "text") as Record<string, unknown> | undefined;
  if (typeof text?.text !== "string" || !text.text.trim()) throw new Error("Claudeから投稿案を取得できませんでした。");
  const usage = payload.usage as Record<string, unknown> | undefined;
  return { content: text.text.trim(), inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : undefined, outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined };
}

async function generateGemini(apiKey: string, model: string, input: CompletionInput): Promise<ProviderGeneration> {
  const encodedModel = encodeURIComponent(model);
  const payload = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: input.system }] }, contents: [{ role: "user", parts: [{ text: `${input.prompt}\n\n出力はJSONのみで返してください。` }] }], generationConfig: { responseMimeType: "application/json" } }),
  }, "Gemini");
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const candidate = candidates[0] as Record<string, unknown> | undefined;
  const content = candidate?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const text = parts.find(part => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") as Record<string, unknown> | undefined;
  if (typeof text?.text !== "string" || !text.text.trim()) throw new Error("Geminiから投稿案を取得できませんでした。");
  const usage = payload.usageMetadata as Record<string, unknown> | undefined;
  return { content: text.text.trim(), inputTokens: typeof usage?.promptTokenCount === "number" ? usage.promptTokenCount : undefined, outputTokens: typeof usage?.candidatesTokenCount === "number" ? usage.candidatesTokenCount : undefined };
}

export async function generateWithProvider(connection: ProviderConnectionForUse, input: CompletionInput): Promise<ProviderGeneration> {
  const apiKey = decryptApiKey(connection);
  switch (connection.provider) {
    case "openai": return generateOpenAiCompatible("https://api.openai.com/v1/chat/completions", apiKey, connection.model, input, "OpenAI");
    case "anthropic": return generateAnthropic(apiKey, connection.model, input);
    case "gemini": return generateGemini(apiKey, connection.model, input);
    case "openrouter": return generateOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", apiKey, connection.model, input, "OpenRouter", { "X-OpenRouter-Title": "SNS Growth Copilot" });
  }
}

export async function generateWithProviderPriority<T extends ProviderConnectionForUse>(connections: T[], input: CompletionInput, useBuiltIn: () => Promise<string>, hooks?: UsageHooks<T>) {
  const enabled = connections.filter(connection => connection.enabled).sort((left, right) => left.priority - right.priority);
  if (!enabled.length) return { content: await useBuiltIn(), provider: "built_in" as const, failures: [] as string[] };
  const failures: string[] = [];
  for (const connection of enabled) {
    let recordId: number | undefined;
    try {
      recordId = hooks ? await hooks.reserve(connection) : undefined;
      const result = await generateWithProvider(connection, input);
      if (hooks && recordId !== undefined) await hooks.success(connection, recordId, result);
      return { ...result, provider: connection.provider, failures };
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(`${providerDefaults[connection.provider].label}への接続に失敗しました。`);
      if (hooks && recordId !== undefined) await hooks.failure(connection, recordId, failure);
      failures.push(failure.message);
    }
  }
  throw new Error(`設定済みのAIプロバイダーに接続できませんでした。${failures.join(" ")}`);
}

export function parseJsonResponse(content: string) {
  const trimmed = content.trim();
  const normalized = trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "") : trimmed;
  return JSON.parse(normalized);
}
