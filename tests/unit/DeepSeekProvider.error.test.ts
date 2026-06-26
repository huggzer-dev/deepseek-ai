import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { asRequestError } from "../../src/llm/DeepSeekError";

describe("DeepSeek error translation", () => {
  test("401 mentions API key", () => {
    const err = asRequestError(401, '{"error":{"message":"Authentication Fails"}}');
    assert.match(err.message, /401/);
    assert.match(err.message, /API key/);
  });
  test("402 includes top-up link", () => {
    const err = asRequestError(402, '{"error":{"message":"Insufficient Balance"}}');
    assert.match(err.message, /402/);
    assert.match(err.message, /balance/i);
    assert.match(err.message, /platform\.deepseek\.com/);
  });
  test("429 mentions rate limit", () => {
    const err = asRequestError(429, "rate limit");
    assert.match(err.message, /429/);
    assert.match(err.message, /Rate limit/);
  });
  test("falls back to raw body when JSON is malformed", () => {
    const err = asRequestError(500, "oops");
    assert.match(err.message, /500/);
    assert.match(err.message, /oops/);
  });
});
