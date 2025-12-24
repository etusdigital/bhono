#!/bin/bash
# Validates skill-rules.json structure and activation system
# Runs on SessionStart to ensure the skill-rules activation works

set -e

# Get .claude directory from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

HOOKS_DIR="$CLAUDE_DIR/hooks"
RULES_FILE="$CLAUDE_DIR/skills/skill-rules.json"

# Install dependencies if needed (silent)
if [ -f "$HOOKS_DIR/package.json" ] && [ ! -d "$HOOKS_DIR/node_modules" ]; then
  echo "📦 Installing hook dependencies..." >&2
  cd "$HOOKS_DIR" && npm install --silent >/dev/null 2>&1
fi

# Make hook executable
if [ -f "$HOOKS_DIR/skill-activation-prompt.sh" ]; then
  chmod +x "$HOOKS_DIR/skill-activation-prompt.sh" 2>/dev/null || true
fi

# Validate skill-rules.json exists
if [ ! -f "$RULES_FILE" ]; then
  echo "❌ skill-rules.json not found at $RULES_FILE" >&2
  echo "   Skill activation will not work properly." >&2
  exit 1
fi

# Validate skill-rules.json is valid JSON
if ! command -v jq >/dev/null 2>&1; then
  # jq not available, skip JSON validation
  echo "⚠️  jq not found, skipping JSON validation" >&2
elif ! jq empty "$RULES_FILE" 2>/dev/null; then
  echo "❌ skill-rules.json is not valid JSON" >&2
  exit 1
fi

# Quick test: Run hook with mock data
TEST_INPUT='{"session_id":"test","transcript_path":"/tmp","cwd":".","permission_mode":"auto","prompt":"test fastapi endpoint"}'
if [ -x "$HOOKS_DIR/skill-activation-prompt.sh" ]; then
  if echo "$TEST_INPUT" | "$HOOKS_DIR/skill-activation-prompt.sh" >/dev/null 2>&1; then
    echo "✅ Skill-rules system validated"
    exit 0
  else
    echo "⚠️  Skill activation hook test failed" >&2
    echo "   Check that dependencies are installed in $HOOKS_DIR" >&2
    exit 1
  fi
else
  echo "⚠️  skill-activation-prompt.sh not found or not executable" >&2
  exit 1
fi
