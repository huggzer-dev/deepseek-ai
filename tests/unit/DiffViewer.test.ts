import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeDiff } from "../../src/ui/DiffViewer";

describe("DiffViewer.computeDiff", () => {
  test("returns empty diff for identical inputs", () => {
    const d = computeDiff("hello\nworld", "hello\nworld");
    assert.equal(d.length, 2);
    assert.equal(d[0].type, "ctx");
    assert.equal(d[1].type, "ctx");
  });

  test("marks removed lines as 'del'", () => {
    const d = computeDiff("a\nb\nc", "a\nc");
    const del = d.filter((l) => l.type === "del");
    const add = d.filter((l) => l.type === "add");
    assert.equal(del.length, 1);
    assert.equal(del[0].text, "b");
    assert.equal(add.length, 0);
  });

  test("marks added lines as 'add'", () => {
    const d = computeDiff("a\nc", "a\nb\nc");
    const add = d.filter((l) => l.type === "add");
    assert.equal(add.length, 1);
    assert.equal(add[0].text, "b");
  });

  test("handles completely different inputs", () => {
    const d = computeDiff("foo", "bar");
    assert.ok(d.some((l) => l.type === "del" && l.text === "foo"));
    assert.ok(d.some((l) => l.type === "add" && l.text === "bar"));
  });

  test("preserves empty lines", () => {
    const d = computeDiff("a\n\nb", "a\n\nb");
    assert.equal(d.length, 3);
    assert.equal(d[1].text, "");
  });

  test("handles empty input", () => {
    const d = computeDiff("", "");
    // Splits on \n yield a single empty string, which becomes one ctx line.
    assert.equal(d.length, 1);
    assert.equal(d[0].type, "ctx");
    assert.equal(d[0].text, "");
  });
});
