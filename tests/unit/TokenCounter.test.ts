import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TokenCounter } from "../../src/llm/TokenCounter";

describe("TokenCounter", () => {
  test("returns 0 for empty input", () => {
    assert.equal(TokenCounter.estimate(""), 0);
  });

  test("estimates Latin text as ~4 chars/token", () => {
    // 20 chars => ~5 tokens
    const est = TokenCounter.estimate("Hello world, test!");
    assert.ok(est >= 4 && est <= 8);
  });

  test("counts CJK chars individually", () => {
    // 10 Chinese chars => ~10 tokens
    const est = TokenCounter.estimate("你好世界测试估算代码");
    assert.equal(est, 10);
  });

  test("handles mixed CJK + Latin", () => {
    // 5 CJK + 17 Latin => ceil(5 + 17/4) = ceil(5 + 4.25) = 10
    const est = TokenCounter.estimate("你好世界测试 hello world!");
    assert.equal(est, 10);
  });

  test("estimateMessages sums content estimates", () => {
    const total = TokenCounter.estimateMessages([
      { content: "hello" },
      { content: "你好" },
      { content: null },
    ]);
    // ceil(5/4) + 2 + 0 = 2 + 2 + 0 = 4
    assert.equal(total, 4);
  });
});
