export interface UploadCandidate {
  name: string;
  type: string;
}

export interface UploadedTextFile {
  name: string;
  text: string;
}

const TEXT_EXTENSIONS = new Set([
  "csv",
  "css",
  "html",
  "js",
  "json",
  "log",
  "md",
  "markdown",
  "txt",
  "ts",
  "tsx",
  "xml",
  "yaml",
  "yml",
]);

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/x-yaml",
  "text/markdown",
]);

export const MAX_TEXT_UPLOAD_BYTES = 1024 * 1024;

export function isTextUpload(file: UploadCandidate): boolean {
  if (file.type.startsWith("text/")) return true;
  if (TEXT_MIME_TYPES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

export function formatUploadedFileContext(file: UploadedTextFile): string {
  return `## Uploaded file: ${file.name}\n\n${file.text}`;
}
