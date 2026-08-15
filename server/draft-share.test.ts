import { describe, expect, it } from "vitest";
import { createXShareUrl } from "../client/src/lib/draft-share";

describe("createXShareUrl", () => {
  it("encodes a Japanese draft into an X compose URL", () => {
    expect(createXShareUrl("AIの学び #SNS")).toBe("https://x.com/intent/post?text=AI%E3%81%AE%E5%AD%A6%E3%81%B3%20%23SNS");
  });
});
