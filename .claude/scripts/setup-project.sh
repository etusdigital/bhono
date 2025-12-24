#!/bin/bash
# One-time setup for Claude Code project configuration
# Sets up statusline and settings.json with required hooks

set -e

# Get directories from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_DIR/.." && pwd)"

SETTINGS_FILE="$CLAUDE_DIR/settings.json"
STATUSLINE_DIR="$CLAUDE_DIR/statusline"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 CLAUDE CODE PROJECT SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup settings.json
echo "⚙️  Configuring settings.json..."
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "✅ Creating new settings.json..."
  cat > "$SETTINGS_FILE" << 'EOF'
{
  "includeCoAuthoredBy": false,
  "env": {
    "BASH_DEFAULT_TIMEOUT_MS": "30000",
    "BASH_MAX_TIMEOUT_MS": "40000",
    "BASH_MAX_OUTPUT_LENGTH": "500000",
    "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR": "1",
    "ENABLE_BACKGROUND_TASKS": "1",
    "MAX_THINKING_TOKENS": "64000",
    "MCP_TIMEOUT": "30000",
    "MCP_TOOL_TIMEOUT": "60000",
    "MAX_MCP_OUTPUT_TOKENS": "50000",
    "CLAUDE_CODE_DISABLE_TERMINAL_TITLE": "1",
    "CLAUDE_CODE_ENABLE_UNIFIED_READ_TOOL": "true",
    "USE_BUILTIN_RIPGREP": "0"
  },
  "enabledMcpjsonServers": [
    "sequential-thinking"
  ],
  "permissions": {
    "allow": [
      "Edit:*",
      "Write:*",
      "MultiEdit:*",
      "NotebookEdit:*",
      "Bash:*",
      "WebSearch:*",
      "WebFetch:*",
      "Bash(grep:*)",
      "Bash(diff:*)",
      "Bash(echo:*)",
      "Bash(tree:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(pnpm:*)",
      "Bash(python:*)",
      "Bash(python3:*)",
      "Bash(uv:*)",
      "Bash(uvx:*)",
      "Bash(psql:*)",
      "Bash(createdb:*)",
      "Bash(curl:*)",
      "Bash(wrangler:*)",
      "Bash(ls:*)",
      "Bash(mkdir:*)",
      "Bash(cp:*)",
      "Bash(mv:*)",
      "Bash(node:*)",
      "Bash(find:*)",
      "Bash(wait)",
      "Bash(git:*)",
      "Bash(gh:*)",
      "Bash(touch:*)",
      "Bash(chmod:*)",
      "Bash(openssl:*)",
      "Bash(sed:*)",
      "Bash(awk:*)",
      "Bash(head:*)",
      "Bash(cat:*)",
      "Bash(tail:*)",
      "Bash(vercel:*)",
      "mcp__sequential-thinking__sequentialthinking"
    ],
    "deny": [],
    "defaultMode": "acceptEdits"
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/skill-activation-prompt.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/scripts/install_pkgs.sh"
          }
        ]
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "bash -c 'input=$(cat); MODEL=$(echo \"$input\" | jq -r \".model.display_name\"); DIR=$(echo \"$input\" | jq -r \".workspace.current_dir\"); BRANCH=\"\"; if git rev-parse --git-dir >/dev/null 2>&1; then BRANCH=\" | 🌿 $(git branch --show-current 2>/dev/null)\"; CHANGES=$(git status --porcelain 2>/dev/null | wc -l); if [ $CHANGES -gt 0 ]; then BRANCH=\"$BRANCH ($CHANGES)\"; fi; fi; echo \"[$MODEL] 📁 ${DIR##*/}$BRANCH\"'"
  }
}
EOF
  echo "✅ settings.json created with all required configuration"
  echo "✅ Statusline configured (git branch + model info)"
else
  # Backup existing settings
  BACKUP_FILE="$SETTINGS_FILE.backup.$(date +%s)"
  cp "$SETTINGS_FILE" "$BACKUP_FILE"
  echo "📦 Existing settings backed up to: ${BACKUP_FILE##*/}"
  echo ""

  # Check if jq is available for statusLine merging
  if command -v jq >/dev/null 2>&1; then
    # Check if statusLine already exists
    HAS_STATUSLINE=$(jq 'has("statusLine")' "$SETTINGS_FILE")

    if [ "$HAS_STATUSLINE" = "false" ]; then
      echo "📊 Adding statusLine configuration..."
      STATUSLINE_CMD='bash -c '\''input=$(cat); MODEL=$(echo "$input" | jq -r ".model.display_name"); DIR=$(echo "$input" | jq -r ".workspace.current_dir"); BRANCH=""; if git rev-parse --git-dir >/dev/null 2>&1; then BRANCH=" | 🌿 $(git branch --show-current 2>/dev/null)"; CHANGES=$(git status --porcelain 2>/dev/null | wc -l); if [ $CHANGES -gt 0 ]; then BRANCH="$BRANCH ($CHANGES)"; fi; fi; echo "[$MODEL] 📁 ${DIR##*/}$BRANCH"'\'''
      jq --arg cmd "$STATUSLINE_CMD" '. + {statusLine: {type: "command", command: $cmd}}' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp"
      mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
      echo "✅ Statusline configured (git branch + model info)"
      echo ""
    else
      echo "ℹ️  Statusline already configured (skipping)"
      echo ""
    fi
  else
    echo "⚠️  jq not found - skipping statusLine auto-configuration"
    echo "   jq is required for automatic statusLine setup"
    echo ""
    echo "   To install jq:"
    echo "     macOS: brew install jq"
    echo "     Linux: sudo apt-get install jq"
    echo ""
  fi

  echo "⚠️  settings.json already exists"
  echo ""
  echo "📋 Please manually verify these hooks are configured:"
  echo ""
  echo "   UserPromptSubmit hook:"
  echo '     $CLAUDE_PROJECT_DIR/.claude/hooks/skill-activation-prompt.sh'
  echo ""
  echo "   SessionStart hooks:"
  echo '     $CLAUDE_PROJECT_DIR/.claude/scripts/install_pkgs.sh'
  echo ""
  echo "💡 Settings backed up before modifications"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Review .claude/settings.json"
echo "  2. Start a new Claude Code session"
echo "  3. Verify skill activation works"
echo ""
