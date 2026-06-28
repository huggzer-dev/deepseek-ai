import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { chatControlLabel, nextEffort } from "../../src/ui/ChatControls";

describe("chat controls", () => {
  test("summarizes the selected model and effort in one compact label", () => {
    assert.equal(chatControlLabel("deepseek-v4-flash", "medium"), "V4 Flash · Med");
    assert.equal(chatControlLabel("deepseek-v4-pro", "high"), "V4 Pro · High");
  });

  test("cycles effort in a stable low to medium to high order", () => {
    assert.equal(nextEffort("low"), "medium");
    assert.equal(nextEffort("medium"), "high");
    assert.equal(nextEffort("high"), "low");
  });
});
