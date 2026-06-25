import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "../../src/tools/ToolRegistry";
import { RiskLevel } from "../../src/types";
import type { ToolContext, ToolResult } from "../../src/types";

function fakeCtx(): ToolContext {
  return {
    app: {} as never,
    vault: {} as never,
    workspace: {} as never,
  };
}

describe("ToolRegistry", () => {
  test("register and get", () => {
    const reg = new ToolRegistry();
    reg.register({
      name: "ping",
      description: "ping",
      parameters: { type: "object" },
      riskLevel: RiskLevel.READ_ONLY,
      execute: async () => ({ success: true }),
    });
    assert.ok(reg.get("ping"));
    assert.equal(reg.get("missing"), undefined);
  });

  test("execute routes to the right tool", async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: "echo",
      description: "echo",
      parameters: { type: "object" },
      riskLevel: RiskLevel.READ_ONLY,
      execute: async (args) => ({ success: true, data: args }),
    });
    const r = await reg.execute("echo", { x: 1 }, fakeCtx());
    assert.deepEqual(r.data, { x: 1 });
  });

  test("execute returns error for unknown tool", async () => {
    const reg = new ToolRegistry();
    const r = await reg.execute("nope", {}, fakeCtx());
    assert.equal(r.success, false);
    assert.match(r.error!, /unknown tool/);
  });

  test("execute catches tool exceptions", async () => {
    const reg = new ToolRegistry();
    reg.register({
      name: "boom",
      description: "boom",
      parameters: { type: "object" },
      riskLevel: RiskLevel.READ_ONLY,
      execute: async () => { throw new Error("nope"); },
    });
    const r = await reg.execute("boom", {}, fakeCtx());
    assert.equal(r.success, false);
    assert.equal(r.error, "nope");
  });

  test("duplicate registration overwrites the prior tool", () => {
    const reg = new ToolRegistry();
    const v1 = {
      name: "x",
      description: "v1",
      parameters: { type: "object" } as Record<string, unknown>,
      riskLevel: RiskLevel.READ_ONLY,
      execute: async (): Promise<ToolResult> => ({ success: true, data: "v1" }),
    };
    const v2 = { ...v1, description: "v2" };
    reg.register(v1);
    reg.register(v2);
    assert.equal(reg.all().length, 1);
    assert.equal(reg.get("x")?.description, "v2");
  });
});
