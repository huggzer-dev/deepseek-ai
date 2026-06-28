import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildUserMessageContent } from "../../src/engine/ContextBuilder";

describe("ContextBuilder attachments", () => {
  test("adds image attachments to user message content", () => {
    assert.deepEqual(buildUserMessageContent({ userInput: "describe this", mentions: [], images: ["data:image/png;base64,abc"] }), [
      { type: "text", text: "describe this" },
      { type: "image_url", image_url: { url: "data:image/png;base64,abc", detail: "auto" } },
    ]);
  });

  test("keeps plain text messages plain when no images are attached", () => {
    assert.equal(buildUserMessageContent({ userInput: "hello", mentions: [] }), "hello");
  });
});
