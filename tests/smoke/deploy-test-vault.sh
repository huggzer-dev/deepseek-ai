#!/usr/bin/env bash
# Bootstrap a local test vault that links to the plugin source.
#
# Usage:  ./tests/smoke/deploy-test-vault.sh
#
# Creates ~/Documents/DeepSeek-Test-Vault/ with a pre-configured
# .obsidian/plugins/deepseek-ai/ symlink to this checkout.
# (Using ~/Documents keeps the vault visible in Finder — /tmp is hidden
#  on modern macOS and the Obsidian "Open another vault" picker won't
#  show it by default.)
#
# Open it with:  open -na Obsidian --args ~/Documents/DeepSeek-Test-Vault

set -euo pipefail

VAULT="$HOME/Documents/DeepSeek-Test-Vault"
PLUGIN_SRC="$(cd "$(dirname "$0")/../.." && pwd)"
PLUGIN_ID="deepseek-ai"

echo "→ Test vault: $VAULT"

# Clean any prior deployment so we get a fresh state.
rm -rf "$VAULT"
mkdir -p "$VAULT/.obsidian/plugins"

# Build first so main.js is current
cd "$PLUGIN_SRC"
npm run build >/dev/null

# Link the plugin directory (symlink → live source)
ln -sfn "$PLUGIN_SRC" "$VAULT/.obsidian/plugins/$PLUGIN_ID"

# Seed Obsidian core config
cat > "$VAULT/.obsidian/obsidian.json" <<'EOF'
{
  "alwaysUpdateLinks": true,
  "newLinkFormat": "shortest",
  "useMarkdownLinks": false,
  "showLineNumber": true,
  "showInlineTitle": true,
  "translucency": false
}
EOF

# app.json — required for Obsidian to recognize the vault properly
cat > "$VAULT/.obsidian/app.json" <<'EOF'
{
  "alwaysUpdateLinks": true,
  "newLinkFormat": "shortest",
  "useMarkdownLinks": false,
  "showLineNumber": true,
  "showInlineTitle": true,
  "translucency": false
}
EOF

# community-plugins.json — must contain the plugin id
cat > "$VAULT/.obsidian/community-plugins.json" <<EOF
[
  "$PLUGIN_ID"
]
EOF

# Pre-trust the plugin so the "Trust author" dialog is skipped.
cat > "$VAULT/.obsidian/community-plugins-trust.json" <<EOF
{
  "$PLUGIN_ID": true
}
EOF

# Sample notes to exercise @mentions
mkdir -p "$VAULT/notes"
cat > "$VAULT/notes/welcome.md" <<'EOF'
# Welcome

This is a test note. Use `@[[notes/welcome]]` in the chat sidebar
to reference it as context.
EOF

cat > "$VAULT/notes/todo.md" <<'EOF'
# TODO

- [x] Set up test vault
- [ ] Send first chat message
- [ ] Try $summarize
EOF

cat > "$VAULT/notes/sample.md" <<'EOF'
# Sample note for inline edit testing

The quick brown fox jumps over the lazy dog.
This sentence is intentionally long enough to give DeepSeek something to rewrite.
EOF

echo "✓ Test vault ready at $VAULT"
echo "  Plugin symlinked: $PLUGIN_SRC"
echo ""
echo "  Open it in Obsidian:"
echo "    open -na Obsidian --args \"$VAULT\""
echo "    # or in Finder, navigate to Documents → DeepSeek-Test-Vault"
