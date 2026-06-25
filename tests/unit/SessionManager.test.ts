import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SessionManager } from "../../src/engine/SessionManager";

describe("SessionManager.restore (regression: tab switching)", () => {
  test("restore() updates the active session even when one is already set", () => {
    const sm = new SessionManager();
    const a = sm.create("a");
    const b = sm.create("b");
    assert.equal(sm.activeSession()?.id, b.id, "newest created session is active by default");
    sm.restore(a);
    assert.equal(sm.activeSession()?.id, a.id, "restore(a) must switch active to a");
    sm.restore(b);
    assert.equal(sm.activeSession()?.id, b.id, "restore(b) must switch active back to b");
  });

  test("list() returns all sessions including the current one", () => {
    const sm = new SessionManager();
    sm.create("first");
    sm.create("second");
    sm.create("third");
    assert.equal(sm.list().length, 3);
  });
});
