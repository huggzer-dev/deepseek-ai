import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { debounce } from "../../src/utils/debounce";

const testWindow = globalThis as typeof globalThis & {
  window?: Pick<Window, "clearTimeout" | "setTimeout">;
};
testWindow.window = {
  clearTimeout: globalThis.clearTimeout as unknown as Window["clearTimeout"],
  setTimeout: globalThis.setTimeout as unknown as Window["setTimeout"],
};

describe("debounce", () => {
  test("calls fn only after wait period", async () => {
    let count = 0;
    const fn = debounce(() => count++, 20);
    fn(); fn(); fn();
    assert.equal(count, 0);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(count, 1);
  });

  test("uses latest args", async () => {
    let last: number | undefined;
    const fn = debounce((n: number) => { last = n; }, 10);
    fn(1); fn(2); fn(3);
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(last, 3);
  });
});
