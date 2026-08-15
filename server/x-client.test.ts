import { describe, expect, it } from "vitest";
import { createOAuth1Header } from "./x-client";

describe("X OAuth 1.0a署名", () => {
  it("投稿API用のユーザーアクセストークンを含む署名ヘッダーを生成する", () => {
    const header = createOAuth1Header("POST", "https://api.x.com/2/tweets", { apiKey: "consumer-key", apiSecret: "consumer-secret", accessToken: "access-token", accessTokenSecret: "access-secret" }, 1_700_000_000, "fixed-nonce");
    expect(header).toContain('oauth_consumer_key="consumer-key"');
    expect(header).toContain('oauth_token="access-token"');
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(header).toContain('oauth_signature="');
    expect(header).not.toContain("consumer-secret");
    expect(header).not.toContain("access-secret");
  });
});
