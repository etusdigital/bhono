#!/bin/bash

echo "📦 Installing dependencies..."

# Install jq if not present (required for statusline setup)
if ! command -v jq >/dev/null 2>&1; then
  echo "Installing jq (required for configuration)..."

  # Detect OS and install accordingly
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use Homebrew
    if command -v brew >/dev/null 2>&1; then
      brew install jq >/dev/null 2>&1 && echo "✅ jq installed via Homebrew"
    else
      echo "⚠️  Homebrew not found. Please install jq manually: brew install jq"
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try apt-get first, then yum
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update >/dev/null 2>&1
      sudo apt-get install -y jq >/dev/null 2>&1 && echo "✅ jq installed via apt-get"
    elif command -v yum >/dev/null 2>&1; then
      sudo yum install -y jq >/dev/null 2>&1 && echo "✅ jq installed via yum"
    else
      echo "⚠️  Package manager not found. Please install jq manually."
    fi
  else
    echo "⚠️  Unsupported OS. Please install jq manually."
  fi
else
  echo "✅ jq already installed"
fi

# Install npm dependencies if package.json exists
if [ -f "package.json" ]; then
  echo "Installing npm packages..."
  npm install
fi

# Install Python dependencies with uv if pyproject.toml exists
if [ -f "pyproject.toml" ]; then
  echo "Installing Python packages with uv..."
  uv sync
fi

echo "✅ Dependencies installed"
exit 0
