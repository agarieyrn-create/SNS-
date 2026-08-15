import { createHmac, randomBytes } from "crypto";
import type { XAccountConnection } from "../drizzle/schema";
import { decryptApiKey } from "./ai-provider-gateway";

export type XCredentials = { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string };

function decodeField(encryptedApiKey: string, encryptionIv: string, encryptionTag: string) {
  return decryptApiKey({ encryptedApiKey, encryptionIv, encryptionTag });
}

export function decryptXCredentials(connection: XAccountConnection): XCredentials {
  return {
    apiKey: decodeField(connection.encryptedApiKey, connection.apiKeyIv, connection.apiKeyTag),
    apiSecret: decodeField(connection.encryptedApiSecret, connection.apiSecretIv, connection.apiSecretTag),
    accessToken: decodeField(connection.encryptedAccessToken, connection.accessTokenIv, connection.accessTokenTag),
    accessTokenSecret: decodeField(connection.encryptedAccessTokenSecret, connection.accessTokenSecretIv, connection.accessTokenSecretTag),
  };
}

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function createOAuth1Header(method: "GET" | "POST", url: string, credentials: XCredentials, now = Math.floor(Date.now() / 1000), nonce = randomBytes(16).toString("hex")) {
  const oauth = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(now),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };
  const parameterString = Object.entries(oauth).map(([key, value]) => [encode(key), encode(value)] as const).sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)).map(([key, value]) => `${key}=${value}`).join("&");
  const baseString = `${method}&${encode(url)}&${encode(parameterString)}`;
  const signingKey = `${encode(credentials.apiSecret)}&${encode(credentials.accessTokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  const withSignature = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.entries(withSignature).map(([key, value]) => `${encode(key)}="${encode(value)}"`).sort().join(", ")}`;
}

async function xRequest(method: "GET" | "POST", url: string, credentials: XCredentials, body?: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method,
      headers: { Authorization: createOAuth1Header(method, url, credentials), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const detail = typeof payload.detail === "string" ? payload.detail : typeof payload.title === "string" ? payload.title : typeof (payload.errors as Array<{ message?: string }> | undefined)?.[0]?.message === "string" ? (payload.errors as Array<{ message: string }>)[0].message : `HTTP ${response.status}`;
      throw new Error(`X APIへの接続に失敗しました: ${detail.slice(0, 220)}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("X APIからの応答がタイムアウトしました。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testXConnection(connection: XAccountConnection) {
  const payload = await xRequest("GET", "https://api.x.com/2/users/me", decryptXCredentials(connection));
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data || typeof data.id !== "string") throw new Error("Xアカウント情報を取得できませんでした。権限と認証情報を確認してください。");
  return { userId: data.id, username: typeof data.username === "string" ? data.username : null };
}

export async function createXPost(connection: XAccountConnection, text: string) {
  if (!text.trim()) throw new Error("投稿内容が空です。");
  if (Array.from(text).length > 280) throw new Error("Xへの投稿は280文字以内にしてください。");
  const payload = await xRequest("POST", "https://api.x.com/2/tweets", decryptXCredentials(connection), { text });
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data || typeof data.id !== "string") throw new Error("Xの投稿IDを取得できませんでした。");
  return { id: data.id, text: typeof data.text === "string" ? data.text : text };
}
