import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { shouldRequireToolApproval } from "../../src/engine/ApprovalPolicy";
import { DEFAULT_SETTINGS, RiskLevel } from "../../src/types";

describe("tool approval policy", () => {
  test("requires approval for EDIT_DANGER by default", () => {
    assert.equal(shouldRequireToolApproval(RiskLevel.EDIT_DANGER, DEFAULT_SETTINGS), true);
  });

  test("does not require approval at or below autoApproveRisk", () => {
    const settings = { ...DEFAULT_SETTINGS, autoApproveRisk: RiskLevel.EDIT_DANGER };

    assert.equal(shouldRequireToolApproval(RiskLevel.READ_ONLY, settings), false);
    assert.equal(shouldRequireToolApproval(RiskLevel.EDIT_SAFE, settings), false);
    assert.equal(shouldRequireToolApproval(RiskLevel.EDIT_DANGER, settings), false);
  });

  test("requires approval above autoApproveRisk", () => {
    const settings = { ...DEFAULT_SETTINGS, autoApproveRisk: RiskLevel.EDIT_DANGER };

    assert.equal(shouldRequireToolApproval(RiskLevel.EXTERNAL, settings), true);
  });
});
