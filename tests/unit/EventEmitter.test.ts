import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "../../src/utils/EventEmitter";

describe("EventEmitter", () => {
  test("emit calls registered listener", () => {
    const e = new EventEmitter<{ ping: string }>();
    const calls: string[] = [];
    e.on("ping", (p) => calls.push(p));
    e.emit("ping", "hello");
    assert.deepEqual(calls, ["hello"]);
  });

  test("off removes a listener", () => {
    const e = new EventEmitter<{ ping: string }>();
    const calls: string[] = [];
    const unsub = e.on("ping", (p) => calls.push(p));
    e.emit("ping", "a");
    unsub();
    e.emit("ping", "b");
    assert.deepEqual(calls, ["a"]);
  });

  test("multiple listeners all fire", () => {
    const e = new EventEmitter<{ x: number }>();
    let a = 0, b = 0;
    e.on("x", () => a++);
    e.on("x", () => b++);
    e.emit("x", 1);
    assert.equal(a, 1);
    assert.equal(b, 1);
  });

  test("listener errors don't break other listeners", () => {
    const e = new EventEmitter<{ x: number }>();
    const calls: number[] = [];
    e.on("x", () => { throw new Error("boom"); });
    e.on("x", (p) => calls.push(p));
    e.emit("x", 5);
    assert.deepEqual(calls, [5]);
  });
});
