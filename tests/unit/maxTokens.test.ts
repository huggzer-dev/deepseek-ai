import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MAX_TOKENS_LIMIT, MIN_TOKENS_LIMIT, DEFAULT_MAX_TOKENS } from "../../src/types";

describe("max_tokens bounds", () => {
  test("MAX_TOKENS_LIMIT is 393216 (DeepSeek hard cap)", () => {
    assert.equal(MAX_TOKENS_LIMIT, 393216);
  });

  test("MIN_TOKENS_LIMIT is 1", () => {
    assert.equal(MIN_TOKENS_LIMIT, 1);
  });

  test("DEFAULT_MAX_TOKENS is reasonable (≤ hard cap)", () => {
    assert.ok(DEFAULT_MAX_TOKENS >= MIN_TOKENS_LIMIT);
    assert.ok(DEFAULT_MAX_TOKENS <= MAX_TOKENS_LIMIT);
  });
});
