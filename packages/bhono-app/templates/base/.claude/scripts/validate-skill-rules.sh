#!/bin/bash
# Validates skill-rules.json structure and activation system
# Runs on SessionStart to ensure the skill-rules activation works

set -e

# Get .claude directory from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

HOOKS_DIR="$CLAUDE_DIR/hooks"
RULES_FILE="$CLAUDE_DIR/skills/skill-rules.json"

# Collect messages
MESSAGES=""

# Install dependencies if needed (silent)
if [ -f "$HOOKS_DIR/package.json" ] && [ ! -d "$HOOKS_DIR/node_modules" ]; then
  cd "$HOOKS_DIR" && npm install --silent >/dev/null 2>&1
fi

# Make hook executable
if [ -f "$HOOKS_DIR/skill-activation-prompt.sh" ]; then
  chmod +x "$HOOKS_DIR/skill-activation-prompt.sh" 2>/dev/null || true
fi

# Validate skill-rules.json exists
if [ ! -f "$RULES_FILE" ]; then
  MESSAGES+="❌ skill-rules.json not found\n"
  MESSAGES+="   Skill activation will not work properly.\n"

  jq -n --arg msg "$(echo -e "$MESSAGES")" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $msg
    }
  }'
  exit 1
fi

# Validate skill-rules.json is valid JSON
if ! command -v jq >/dev/null 2>&1; then
  # jq not available, skip JSON validation
  MESSAGES+="⚠️  jq not found, skipping JSON validation\n"
elif ! jq empty "$RULES_FILE" 2>/dev/null; then
  MESSAGES+="❌ skill-rules.json is not valid JSON\n"

  jq -n --arg msg "$(echo -e "$MESSAGES")" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $msg
    }
  }'
  exit 1
fi

# Quick test: Run hook with mock data
TEST_INPUT='{"session_id":"test","transcript_path":"/tmp","cwd":".","permission_mode":"auto","prompt":"test fastapi endpoint"}'
if [ -x "$HOOKS_DIR/skill-activation-prompt.sh" ]; then
  if echo "$TEST_INPUT" | "$HOOKS_DIR/skill-activation-prompt.sh" >/dev/null 2>&1; then
    MESSAGES+="✅ Skill-rules system validated"
  else
    MESSAGES+="⚠️  Skill activation hook test failed\n"
    MESSAGES+="   Check that dependencies are installed in $HOOKS_DIR\n"

    jq -n --arg msg "$(echo -e "$MESSAGES")" '{
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: $msg
      }
    }'
    exit 1
  fi
else
  MESSAGES+="⚠️  skill-activation-prompt.sh not found or not executable\n"

  jq -n --arg msg "$(echo -e "$MESSAGES")" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $msg
    }
  }'
  exit 1
fi

# Output success message in Claude Code format with visual reminder
jq -n --arg msg "<important-reminder>IN YOUR FIRST REPLY AFTER SEEING THIS MESSAGE YOU MUST TELL THE USER:\n$(echo -e "$MESSAGES")</important-reminder>" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $msg
  }
}'

exit 0
