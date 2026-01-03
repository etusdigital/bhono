#!/bin/bash

# Collect output messages
OUTPUT=""

OUTPUT+="📦 Installing dependencies...\n"

# Install jq if not present (required for statusline setup)
if ! command -v jq >/dev/null 2>&1; then
  OUTPUT+="Installing jq (required for configuration)...\n"

  # Detect OS and install accordingly
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use Homebrew
    if command -v brew >/dev/null 2>&1; then
      if brew install jq >/dev/null 2>&1; then
        OUTPUT+="✅ jq installed via Homebrew\n"
      fi
    else
      OUTPUT+="⚠️  Homebrew not found. Please install jq manually: brew install jq\n"
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try apt-get first, then yum
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update >/dev/null 2>&1
      if sudo apt-get install -y jq >/dev/null 2>&1; then
        OUTPUT+="✅ jq installed via apt-get\n"
      fi
    elif command -v yum >/dev/null 2>&1; then
      if sudo yum install -y jq >/dev/null 2>&1; then
        OUTPUT+="✅ jq installed via yum\n"
      fi
    else
      OUTPUT+="⚠️  Package manager not found. Please install jq manually.\n"
    fi
  else
    OUTPUT+="⚠️  Unsupported OS. Please install jq manually.\n"
  fi
else
  OUTPUT+="✅ jq already installed\n"
fi

# Install npm dependencies if package.json exists
if [ -f "package.json" ]; then
  OUTPUT+="Installing npm packages...\n"
  npm install >/dev/null 2>&1
fi

# Install Python dependencies with uv if pyproject.toml exists
if [ -f "pyproject.toml" ]; then
  OUTPUT+="Installing Python packages with uv...\n"
  uv sync >/dev/null 2>&1
fi

OUTPUT+="✅ Dependencies installed"

# Output in Claude Code hook format with visual reminder
# Use jq to properly escape the output for JSON
jq -n --arg msg "<important-reminder>IN YOUR FIRST REPLY AFTER SEEING THIS MESSAGE YOU MUST TELL THE USER:\n$(echo -e "$OUTPUT")</important-reminder>" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $msg
  }
}'

exit 0
