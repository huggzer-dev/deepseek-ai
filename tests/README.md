# Testing Guide

This plugin ships with three layers of testing. Run them in order from
fastest to most thorough.

## 1. Typecheck & unit tests (CI default)

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm run test        # node --test tests/unit/*.test.ts
```

The unit suite covers pure logic that does not need Obsidian's DOM:
`DiffViewer`, `TokenCounter`, `path`, `EventEmitter`, `debounce`,
`ToolRegistry`, and `AgentSession` helpers.

## 2. Bundle smoke test

```bash
pnpm run build
pnpm run test:smoke
```

Verifies the built `main.js` is present, under 1 MB, has the
generated-bundle banner, and that `manifest.json` / `versions.json`
/ `LICENSE` exist and pass the official review rules (no "obsidian"
in description, `authorUrl` is a profile, etc).

## 3. End-to-end test in a real Obsidian vault

```bash
./tests/smoke/deploy-test-vault.sh
open -na Obsidian --args /tmp/deepseek-test-vault
```

The script:

1. Creates `/tmp/deepseek-test-vault/`
2. Symlinks `.obsidian/plugins/deepseek-ai/` to this checkout
3. Enables the plugin via `community-plugins.json`
4. Seeds two sample notes for `@mention` testing

Open Obsidian on that vault, then walk through the manual smoke
checklist below.

## Manual E2E checklist

### Phase 1: basic chat
- [ ] Plugin loads without errors in Obsidian console
- [ ] Click ✦ ribbon icon → chat sidebar appears
- [ ] Settings tab opens, save API key
- [ ] Send "hello" → reply appears
- [ ] Reset button clears the conversation

### Phase 2: agent + tools
- [ ] "List my vault files" → tool card visible, no approval prompt (READ_ONLY)
- [ ] "Read welcome.md" → tool card with result preview
- [ ] "Create a file test.md with content hi" → approval modal
- [ ] Approve → file is created, result card shows ok
- [ ] Try reading a non-existent file → error tool result

### Phase 3: inline edit + skills
- [ ] Select text in a note → run "Edit selection with DeepSeek"
- [ ] Enter an instruction, click apply → diff shown
- [ ] Confirm → selection replaced, Ctrl+Z undoes
- [ ] Type `$summarize` in chat → skill body injected
- [ ] Type `# use English` → instruction prepends to next turn

### Phase 4: multi-tab + plan + vision + MCP
- [ ] Click `+` in tab bar → new session
- [ ] Switch between tabs → messages persist
- [ ] Close a tab → confirms deletion
- [ ] Toggle Plan mode → badge appears
- [ ] Ask a complex question with Plan on → "## Plan" output visible
- [ ] Drag an image into the input bar → thumbnail appears
- [ ] Send message with image → AI describes it
- [ ] Settings → language → English → all UI refreshes

### Mobile (optional, requires physical device)
- [ ] BRAT-install the plugin on iOS / Android
- [ ] Send a chat message over cellular
- [ ] Verify @mention dropdown still works on touch

## Troubleshooting

- **"Plugin failed to load"** — check Obsidian's View → Toggle Developer Tools console.
- **"API error 401"** — API key is missing or invalid.
- **Tool call never returns** — check network access to `api.deepseek.com`.
