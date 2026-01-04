#!/bin/bash
# Validates skill-rules.json structure and hook system
# Runs on SessionStart to ensure the skill activation works

set -e

# Get .claude directory from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

HOOKS_DIR="$CLAUDE_DIR/hooks"
RULES_FILE="$CLAUDE_DIR/skills/skill-rules.json"

# Collect messages
MESSAGES=""
ERRORS=0

# Install dependencies if needed (silent)
if [ -f "$HOOKS_DIR/package.json" ] && [ ! -d "$HOOKS_DIR/node_modules" ]; then
  cd "$HOOKS_DIR" && npm install --silent >/dev/null 2>&1
fi

# Make hooks executable
for hook in "$HOOKS_DIR"/*.sh; do
  if [ -f "$hook" ]; then
    chmod +x "$hook" 2>/dev/null || true
  fi
done

# Validate skill-rules.json exists
if [ ! -f "$RULES_FILE" ]; then
  MESSAGES+="❌ skill-rules.json not found\n"
  ERRORS=$((ERRORS + 1))

  jq -n --arg msg "$(echo -e "$MESSAGES")" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $msg
    }
  }'
  exit 1
fi

# Validate skill-rules.json is valid JSON and check version
if ! command -v jq >/dev/null 2>&1; then
  MESSAGES+="⚠️  jq not found, skipping JSON validation\n"
elif ! jq empty "$RULES_FILE" 2>/dev/null; then
  MESSAGES+="❌ skill-rules.json is not valid JSON\n"
  ERRORS=$((ERRORS + 1))

  jq -n --arg msg "$(echo -e "$MESSAGES")" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $msg
    }
  }'
  exit 1
else
  # Check version
  VERSION=$(jq -r '.version // "unknown"' "$RULES_FILE")
  SKILL_COUNT=$(jq '.skills | length' "$RULES_FILE")
  TOOLGUARDS_COUNT=$(jq '[.skills[] | select(.toolGuards != null)] | length' "$RULES_FILE")
fi

# Test skill-activation-prompt hook
TEST_PROMPT='{"session_id":"test","transcript_path":"/tmp","cwd":".","permission_mode":"auto","prompt":"analyze architecture of codebase"}'
if [ -x "$HOOKS_DIR/skill-activation-prompt.sh" ]; then
  if echo "$TEST_PROMPT" | "$HOOKS_DIR/skill-activation-prompt.sh" >/dev/null 2>&1; then
    MESSAGES+="✅ skill-activation-prompt hook OK\n"
  else
    MESSAGES+="⚠️  skill-activation-prompt test failed\n"
    ERRORS=$((ERRORS + 1))
  fi
else
  MESSAGES+="❌ skill-activation-prompt.sh not found or not executable\n"
  ERRORS=$((ERRORS + 1))
fi

# Test skill-tool-guard hook
TEST_TOOL='{"session_id":"test","tool_name":"Bash","tool_input":{"command":"git push origin main"}}'
if [ -x "$HOOKS_DIR/skill-tool-guard.sh" ]; then
  if echo "$TEST_TOOL" | "$HOOKS_DIR/skill-tool-guard.sh" >/dev/null 2>&1; then
    MESSAGES+="✅ skill-tool-guard hook OK\n"
  else
    MESSAGES+="⚠️  skill-tool-guard test failed\n"
    ERRORS=$((ERRORS + 1))
  fi
else
  MESSAGES+="❌ skill-tool-guard.sh not found or not executable\n"
  ERRORS=$((ERRORS + 1))
fi

# Summary
if [ $ERRORS -eq 0 ]; then
  SUMMARY="✅ Skill-rules system validated (v${VERSION}, ${SKILL_COUNT} skills, ${TOOLGUARDS_COUNT} with toolGuards)"
else
  SUMMARY="⚠️  Skill-rules validation: ${ERRORS} issue(s) found"
fi

# Build final message
FINAL_MSG="$SUMMARY"
if [ -n "$MESSAGES" ]; then
  # Only include details if there were issues
  if [ $ERRORS -gt 0 ]; then
    FINAL_MSG+="\n$(echo -e "$MESSAGES")"
  fi
fi

# Output success message in Claude Code format with visual reminder
jq -n --arg msg "<important-reminder>IN YOUR FIRST REPLY AFTER SEEING THIS MESSAGE YOU MUST TELL THE USER:\n${FINAL_MSG}</important-reminder>" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $msg
  }
}'

exit 0
