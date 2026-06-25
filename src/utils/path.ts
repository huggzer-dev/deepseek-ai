/** Vault path helpers (Obsidian paths are forward-slash POSIX). */

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.join("/"));
}

export function dirname(path: string): string {
  const norm = normalizePath(path);
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? "/" : norm.slice(0, idx);
}

export function basename(path: string, stripExt = false): string {
  const norm = normalizePath(path);
  const file = norm.slice(norm.lastIndexOf("/") + 1);
  return stripExt ? file.replace(/\.[^.]+$/, "") : file;
}

export function extname(path: string): string {
  const file = basename(path);
  const idx = file.lastIndexOf(".");
  return idx === -1 ? "" : file.slice(idx);
}