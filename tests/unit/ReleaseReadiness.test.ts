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
  test("declares an Obsidian minAppVersion that supports the APIs in use", () => {
    const root = process.cwd();
    const settingsSource = readFileSync(join(root, "src/settings/SettingsTab.ts"), "utf8");
    const usesDeclarativeSettings = /getSettingDefinitions\(|this\.update\(/.test(settingsSource);
    if (!usesDeclarativeSettings) return;

    const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as { minAppVersion?: string; version?: string };
    const versions = JSON.parse(readFileSync(join(root, "versions.json"), "utf8")) as Record<string, string>;
    assert.ok(manifest.minAppVersion);
    assert.ok(atLeastVersion(manifest.minAppVersion, "1.13.0"), `manifest minAppVersion ${manifest.minAppVersion} must be at least 1.13.0`);
    if (manifest.version) {
      assert.ok(atLeastVersion(versions[manifest.version] ?? "0.0.0", "1.13.0"), `versions.json ${manifest.version} must be at least 1.13.0`);
    }
  });

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
      { label: "deprecated self display refresh", pattern: /this\.display\(/ },
      { label: "global timer", pattern: /(^|[^.])\b(?:setTimeout|clearTimeout)\(/ },
      { label: "popup-incompatible document", pattern: /\bdocument\./ },
      { label: "popup-incompatible globalThis", pattern: /\bglobalThis\b/ },
      { label: "non-Error promise rejection", pattern: /reject\(reader\.error\)/ },
      { label: "regex empty class warning", pattern: /\[\^\]\[\]/ },
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

  test("chat styles follow Obsidian light and dark theme variables", () => {
    const root = process.cwd();
    const styles = readFileSync(join(root, "styles.css"), "utf8");

    assert.match(styles, /body\.theme-dark\s*\{/);
    assert.match(styles, /--dsai-bg:\s*var\(--background-primary/);
    assert.match(styles, /--dsai-bg-2:\s*var\(--background-secondary/);
    assert.match(styles, /--dsai-text:\s*var\(--text-normal/);
    assert.match(styles, /--dsai-text-muted:\s*var\(--text-muted/);
  });
});

function atLeastVersion(actual: string, required: string): boolean {
  const actualParts = actual.split(".").map(Number);
  const requiredParts = required.split(".").map(Number);
  for (let i = 0; i < Math.max(actualParts.length, requiredParts.length); i += 1) {
    const a = actualParts[i] ?? 0;
    const r = requiredParts[i] ?? 0;
    if (a > r) return true;
    if (a < r) return false;
  }
  return true;
}
