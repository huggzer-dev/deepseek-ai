import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizePath, joinPath, dirname, basename, extname } from "../../src/utils/path";

describe("path utils", () => {
  test("normalizePath strips trailing slashes", () => {
    assert.equal(normalizePath("/foo/bar/"), "foo/bar");
    assert.equal(normalizePath("foo//bar"), "foo/bar");
  });

  test("joinPath concatenates and normalizes", () => {
    assert.equal(joinPath("foo", "bar", "baz"), "foo/bar/baz");
  });

  test("dirname returns parent directory", () => {
    assert.equal(dirname("a/b/c.md"), "a/b");
    assert.equal(dirname("c.md"), ".");
    assert.equal(dirname(""), "");
  });

  test("basename returns file name", () => {
    assert.equal(basename("a/b/c.md"), "c.md");
    assert.equal(basename("a/b/c.md", true), "c");
  });

  test("extname returns file extension", () => {
    assert.equal(extname("a/b/c.md"), ".md");
    assert.equal(extname("a/b/c"), "");
  });
});
