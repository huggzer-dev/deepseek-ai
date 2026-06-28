import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatUploadedFileContext, isTextUpload } from "../../src/ui/UploadAttachment";

describe("uploaded file attachments", () => {
  test("accepts common text-like files for context upload", () => {
    assert.equal(isTextUpload({ name: "notes.md", type: "text/markdown" }), true);
    assert.equal(isTextUpload({ name: "data.json", type: "application/json" }), true);
    assert.equal(isTextUpload({ name: "photo.png", type: "image/png" }), false);
  });

  test("formats uploaded text as a named context block", () => {
    assert.equal(
      formatUploadedFileContext({ name: "notes.md", text: "hello\nworld" }),
      "## Uploaded file: notes.md\n\nhello\nworld",
    );
  });
});
