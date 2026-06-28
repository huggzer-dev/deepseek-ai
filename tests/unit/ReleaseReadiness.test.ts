import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      sourceFiles(fullPath, acc);
    } else if (/\.(ts|tsx)$/.test(name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

describe("release readiness", () => {
  test("source files do not ship placeholder implementations", () => {
    const root = process.cwd();
    const markers = ["TO" + "DO", "FIX" + "ME", "HA" + "CK", "X" + "XX", "not " + "implemented", "st" + "ub"];
    const placeholders = new RegExp(`\\b(?:${markers.join("|")})\\b`, "i");
    const hits = sourceFiles(join(root, "src")).flatMap((file) =>
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line, index) => ({ file: relative(root, file), line: index + 1, text: line.trim() }))
        .filter(({ text }) => placeholders.test(text)),
    );

    assert.deepEqual(hits, []);
  });

  test("source files avoid Obsidian review-blocked APIs", () => {
    const root = process.cwd();
    const blocked = [
      { label: "raw fetch", pattern: /\bfetch\s*\(/ },
      { label: "child_process", pattern: /child_process/ },
    ];
    const hits = sourceFiles(join(root, "src")).flatMap((file) => {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      return lines.flatMap((line, index) =>
        blocked
          .filter(({ pattern }) => pattern.test(line))
          .map(({ label }) => ({ label, file: relative(root, file), line: index + 1, text: line.trim() })),
      );
    });

    assert.deepEqual(hits, []);
  });

  test("source files avoid review-warning patterns", () => {
    const root = process.cwd();
    const warningPatterns = [
      { label: "deprecated setDynamicTooltip", pattern: /setDynamicTooltip\(/ },
      { label: "global timer", pattern: /(^|[^.])\b(?:setTimeout|clearTimeout)\(/ },
      { label: "non-Error promise rejection", pattern: /reject\(reader\.error\)/ },
    ];
    const hits = sourceFiles(join(root, "src")).flatMap((file) => {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      return lines.flatMap((line, index) =>
        warningPatterns
          .filter(({ pattern }) => pattern.test(line))
          .map(({ label }) => ({ label, file: relative(root, file), line: index + 1, text: line.trim() })),
      );
    });

    assert.deepEqual(hits, []);
  });
});
