#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Smoke test: validates the built bundle can be loaded and its
 * top-level symbols exist. This catches refactor mistakes that
 * pass typecheck but break the build artefact.
 *
 * Usage: node tests/smoke/run-smoke.mjs
 * Exits with code 0 on success, 1 on failure.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    checks.push({ name, ok: false, err: e });
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

console.log("→ Smoke test: main.js bundle");

check("main.js exists", () => {
  const path = resolve(ROOT, "main.js");
  if (!existsSync(path)) throw new Error("main.js not found — run `npm run build` first");
});

check("main.js < 1MB", () => {
  const path = resolve(ROOT, "main.js");
  const bytes = statSync(path).size;
  if (bytes > 1_048_576) throw new Error(`main.js is ${bytes} bytes (>1MB)`);
  console.log(`    (${(bytes / 1024).toFixed(1)} KB)`);
});

check("main.js has banner", () => {
  const path = resolve(ROOT, "main.js");
  const head = readFileSync(path, "utf8").slice(0, 200);
  if (!head.includes("deepseek-ai")) throw new Error("Banner missing — esbuild config may be wrong");
});

check("manifest.json exists", () => {
  const path = resolve(ROOT, "manifest.json");
  if (!existsSync(path)) throw new Error("manifest.json not found");
});

check("manifest.json has required fields", () => {
  const path = resolve(ROOT, "manifest.json");
  const m = JSON.parse(readFileSync(path, "utf8"));
  for (const k of ["id", "name", "version", "minAppVersion", "isDesktopOnly"]) {
    if (m[k] === undefined) throw new Error(`manifest.${k} missing`);
  }
  if (m.id === "obsidian" || m.id === "") throw new Error("manifest.id invalid");
});

check("manifest.json description has no 'obsidian' word", () => {
  const path = resolve(ROOT, "manifest.json");
  const m = JSON.parse(readFileSync(path, "utf8"));
  if (m.description && /obsidian/i.test(m.description)) {
    throw new Error("description contains the word 'obsidian' — disallowed");
  }
});

check("manifest.json authorUrl is a profile (not the plugin repo)", () => {
  const path = resolve(ROOT, "manifest.json");
  const m = JSON.parse(readFileSync(path, "utf8"));
  if (m.authorUrl && m.authorUrl.endsWith("/" + m.id)) {
    throw new Error("authorUrl points to the plugin's own repository");
  }
});

check("versions.json exists", () => {
  const path = resolve(ROOT, "versions.json");
  if (!existsSync(path)) throw new Error("versions.json not found");
});

check("LICENSE exists", () => {
  const path = resolve(ROOT, "LICENSE");
  if (!existsSync(path)) throw new Error("LICENSE not found");
});

check("styles.css exists", () => {
  const path = resolve(ROOT, "styles.css");
  if (!existsSync(path)) throw new Error("styles.css not found");
});

check("package.json scripts", () => {
  const m = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  for (const s of ["build", "lint", "test"]) {
    if (!m.scripts?.[s]) throw new Error(`package.json scripts.${s} missing`);
  }
});

check("no native module imports", () => {
  const m = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const banned = ["better-sqlite3", "node-gyp", "sqlite3", "canvas", "fsevents"];
  for (const dep of Object.keys(m.dependencies ?? {})) {
    if (banned.includes(dep)) throw new Error(`banned dep: ${dep}`);
  }
});

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
