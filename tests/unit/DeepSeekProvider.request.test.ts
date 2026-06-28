import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildChatRequestBody } from "../../src/llm/DeepSeekRequest";

describe("DeepSeek request body", () => {
  test("includes selected model and reasoning effort", () => {
    const body = buildChatRequestBody(
      [{ role: "user", content: "hello" }],
      { model: "deepseek-v4-pro", maxTokens: 8192, temperature: 0.7, effort: "medium" },
    );

    assert.equal(body.model, "deepseek-v4-pro");
    assert.equal(body.reasoning_effort, "medium");
  });
});
