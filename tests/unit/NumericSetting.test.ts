import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatNumericSetting, normalizeNumericSetting, NUMERIC_SETTING_SPECS, recommendedNumericText } from "../../src/settings/NumericSetting";

describe("numeric setting helpers", () => {
  test("exposes recommended defaults for slider text boxes", () => {
    assert.equal(recommendedNumericText(NUMERIC_SETTING_SPECS.maxTokens), "Recommended: 8192 tokens");
    assert.equal(recommendedNumericText(NUMERIC_SETTING_SPECS.temperature), "Recommended: 0.7");
    assert.equal(recommendedNumericText(NUMERIC_SETTING_SPECS.maxAgentLoops), "Recommended: 12 loops");
  });

  test("normalizes text input to valid slider values", () => {
    assert.equal(normalizeNumericSetting("999999", NUMERIC_SETTING_SPECS.maxTokens), 64000);
    assert.equal(normalizeNumericSetting("not-a-number", NUMERIC_SETTING_SPECS.maxTokens), 8192);
    assert.equal(normalizeNumericSetting("0.73", NUMERIC_SETTING_SPECS.temperature), 0.75);
    assert.equal(normalizeNumericSetting("-1", NUMERIC_SETTING_SPECS.maxAgentLoops), 1);
  });

  test("formats slider values without noisy trailing zeros", () => {
    assert.equal(formatNumericSetting(0.7, NUMERIC_SETTING_SPECS.temperature), "0.7");
    assert.equal(formatNumericSetting(12, NUMERIC_SETTING_SPECS.maxAgentLoops), "12");
  });
});
