import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSession, pushMessage, newSessionId } from "../../src/engine/AgentSession";

describe("AgentSession helpers", () => {
  test("newSessionId is unique", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(newSessionId());
    assert.equal(ids.size, 100);
  });

  test("createSession returns a fresh session", () => {
    const s = createSession("hello");
    assert.equal(s.title, "hello");
    assert.equal(s.messages.length, 0);
    assert.ok(s.id);
    assert.ok(s.createdAt > 0);
  });

  test("pushMessage appends and updates timestamp", () => {
    const s = createSession();
    const before = s.updatedAt;
    pushMessage(s, { role: "user", content: "hi" });
    assert.equal(s.messages.length, 1);
    assert.ok(s.updatedAt >= before);
  });
});
