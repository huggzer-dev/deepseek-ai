# DeepSeek AI Assistant

> A powerful AI agent for Obsidian powered by the DeepSeek API. Read, write, search, and manage your vault notes with natural language.

## Features

- **Chat sidebar** — Stream conversation with DeepSeek directly inside Obsidian
- **Always read your vault** — AI can read, search, and list notes using built-in tools
- **Inline editing** — Select text, hit a shortcut, describe the change, preview diff, apply
- **Multi-tab conversations** — Manage multiple independent chat sessions
- **Plan Mode** — Toggle plan-first mode (Shift+Tab) for complex tasks
- **File references** — Use `@[[path]]` to mention notes as context
- **Image analysis** — Drag & paste images for AI vision analysis
- **Skill templates** — `$summarize`, `$translate`, `$outline`, `$brainstorm`, `$review`
- **Instruction mode** — `# instruction` prepends turn-level directives
- **Mobile support** — Works on iOS and Android (Obsidian mobile)
- **MCP Client** — Optional connect MCP tool servers via HTTP
- **i18n** — 简体中文 / English interface

## Installation

### From Community Plugins (pending review)

1. Open Obsidian Settings → Community Plugins
2. Browse for "DeepSeek AI Assistant"
3. Install and Enable
4. Go to plugin settings → enter your DeepSeek API Key

### Manual (development)

Copy `main.js`, `manifest.json`, `styles.css` to your vault's `.obsidian/plugins/deepseek-ai/` directory, then enable in Settings → Community Plugins.

## Getting Started

1. **Get an API Key** — Sign up at [platform.deepseek.com](https://platform.deepseek.com) and create a key
2. **Open the chat** — Click the ✦ icon in the ribbon, or run **Open DeepSeek chat** from the command palette
3. **Send a message** — Type `List my vault files` to see tool calls in action
4. **Inline edit** — Select text in a note → run **Edit selection with DeepSeek** → describe the change
5. **Skills** — Try `$summarize` or `$translate` in chat
6. **Plan Mode** — Toggle in the chat header for step-by-step plans

## Commands

| Command | Description |
|---------|-------------|
| `Open DeepSeek chat` | Opens the chat sidebar |
| `Edit selection with DeepSeek` | Opens inline edit modal for selected text |

## Settings

| Setting | Description |
|---------|-------------|
| API Key | Your DeepSeek API key from platform.deepseek.com |
| Model | `deepseek-v4-flash` (default) or `deepseek-v4-pro` |
| Max Tokens | Context window upper bound (default 64000) |
| Temperature | Sampling temperature 0–2 |
| Language | 简体中文 / English |
| Auto-approve risk level | Tools at/below this level run without confirmation |
| Agent loop cap | Max ReAct iterations (default 12) |

## Architecture

```
User Input → ChatPanel → AgentLoop (ReAct loop) → DeepSeek API
                          ↕                          ↕
                   ToolRegistry ←→ Vault Tools   Provider
                     + MCP                    (requestUrl)
Tool approval         ↓
Modal (if needed) ← AgentLoop → back to LLM
```

Zero external runtime dependencies — no npm packages beyond `obsidian`, `esbuild`, `typescript`.

## Development

```bash
pnpm install
npm run dev    # watch mode
npm run build  # production build
npm run lint   # type check
```

## License

MIT

## Author

huggzer-dev

---

*Progress dashboard: open `progress-dashboard.html` in any browser.*
