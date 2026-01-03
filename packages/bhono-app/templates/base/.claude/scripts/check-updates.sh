#!/bin/bash
# Check for project updates from GitHub
# Runs on SessionStart with 24-hour caching to avoid network overhead

set -e

# Get project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERSION_FILE="$PROJECT_ROOT/VERSION"
CACHE_FILE="$PROJECT_ROOT/.claude/.update-check-cache"
CACHE_TTL=86400  # 24 hours in seconds

# GitHub repository details
REPO_OWNER="etusdigital"
REPO_NAME="ia-setup"
REMOTE_VERSION_URL="https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/main/VERSION"

# Exit silently if VERSION file doesn't exist
if [ ! -f "$VERSION_FILE" ]; then
  exit 0
fi

# Read local version
LOCAL_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')

# Check cache validity
if [ -f "$CACHE_FILE" ]; then
  CACHE_TIME=$(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0)
  CURRENT_TIME=$(date +%s)
  CACHE_AGE=$((CURRENT_TIME - CACHE_TIME))

  if [ $CACHE_AGE -lt $CACHE_TTL ]; then
    # Cache is valid, read cached result
    if [ -s "$CACHE_FILE" ]; then
      CACHED_REMOTE=$(cat "$CACHE_FILE")
      if [ "$CACHED_REMOTE" != "$LOCAL_VERSION" ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🔄 UPDATE AVAILABLE"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Current version: $LOCAL_VERSION"
        echo "Latest version:  $CACHED_REMOTE"
        echo ""
        echo "To update, run:"
        echo "  git pull origin main"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      fi
    fi
    exit 0
  fi
fi

# Cache is stale or doesn't exist, fetch remote version
# Use timeout to prevent hanging (5 second timeout)
REMOTE_VERSION=$(curl -sf --max-time 5 "$REMOTE_VERSION_URL" 2>/dev/null | tr -d '[:space:]' || echo "")

# If fetch failed, exit silently (network might be down)
if [ -z "$REMOTE_VERSION" ]; then
  exit 0
fi

# Cache the remote version
echo "$REMOTE_VERSION" > "$CACHE_FILE"

# Compare versions
if [ "$REMOTE_VERSION" != "$LOCAL_VERSION" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 UPDATE AVAILABLE"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Current version: $LOCAL_VERSION"
  echo "Latest version:  $REMOTE_VERSION"
  echo ""
  echo "To update, run:"
  echo "  git pull origin main"
  echo ""
  echo "Changelog: https://github.com/$REPO_OWNER/$REPO_NAME/blob/main/CHANGELOG.md"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

exit 0
