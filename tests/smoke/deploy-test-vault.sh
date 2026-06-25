#!/usr/bin/env bash
# Bootstrap a local test vault that links to the plugin source.
#
# Usage:  ./tests/smoke/deploy-test-vault.sh
#
# Creates /tmp/deepseek-test-vault/ with a pre-configured
# .obsidian/plugins/deepseek-ai/ symlink to this checkout.
# Open it with:  open -a Obsidian /tmp/deepseek-test-vault/
#                # or for a fresh app instance:  open -na Obsidian --args /tmp/deepseek-test-vault

set -euo pipefail

VAULT=/tmp/deepseek-test-vault
PLUGIN_SRC="$(cd "$(dirname "$0")/../.." && pwd)"
PLUGIN_ID="deepseek-ai"

echo "→ Test vault: $VAULT"
mkdir -p "$VAULT/.obsidian/plugins"

# Build first so main.js is current
cd "$PLUGIN_SRC"
npm run build >/dev/null

# Link the plugin directory
ln -sfn "$PLUGIN_SRC" "$VAULT/.obsidian/plugins/$PLUGIN_ID"

# Seed a basic Obsidian config so the plugin auto-loads.
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

mkdir -p "$VAULT/.obsidian/commander-config"
cat > "$VAULT/.obsidian/community-plugins.json" <<EOF
[ "$PLUGIN_ID" ]
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

echo "✓ Test vault ready at $VAULT"
echo "  Open with:  open -na Obsidian --args $VAULT"
