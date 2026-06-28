import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { shouldCloseSessionFromPointer } from "../../src/ui/ConversationTabs";

describe("ConversationTabs close gesture", () => {
  test("closes only when left and right mouse buttons are pressed together", () => {
    assert.equal(shouldCloseSessionFromPointer({ buttons: 1 }), false);
    assert.equal(shouldCloseSessionFromPointer({ buttons: 2 }), false);
    assert.equal(shouldCloseSessionFromPointer({ buttons: 3 }), true);
  });
});
