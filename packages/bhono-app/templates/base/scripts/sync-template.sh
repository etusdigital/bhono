#!/bin/bash
# scripts/sync-template.sh
# Syncs the main boilerplate to the npm package template

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$ROOT_DIR/packages/bhono-app/templates/base"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Syncing boilerplate to npm template...${NC}"
echo "Source: $ROOT_DIR"
echo "Target: $TEMPLATE_DIR"
echo ""

# Ensure template directory exists
mkdir -p "$TEMPLATE_DIR"

# Rsync with exclusions
# --delete removes files in target that don't exist in source
# --checksum compares by content, not timestamp
rsync -av --checksum --delete \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='.dev.vars' \
  --exclude='db.sqlite' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='packages/' \
  --exclude='pnpm-workspace.yaml' \
  --exclude='pnpm-lock.yaml' \
  --exclude='.changeset/' \
  --exclude='docs/plans/' \
  --exclude='.claude/settings.local.json' \
  --exclude='coverage/' \
  --exclude='test-results/' \
  --exclude='playwright-report/' \
  --exclude='.wrangler/' \
  --exclude='worker-configuration.d.ts' \
  "$ROOT_DIR/" "$TEMPLATE_DIR/"

# Rename .gitignore to _gitignore (npm ignores .gitignore in packages)
if [ -f "$TEMPLATE_DIR/.gitignore" ]; then
  mv "$TEMPLATE_DIR/.gitignore" "$TEMPLATE_DIR/_gitignore"
  echo -e "${GREEN}Renamed .gitignore to _gitignore${NC}"
fi

# Rename .env.example if it exists (keep as is, just ensure it exists)
if [ ! -f "$TEMPLATE_DIR/.env.example" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$TEMPLATE_DIR/.env.example"
fi

# Update package.json in template to use template variables
TEMPLATE_PKG="$TEMPLATE_DIR/package.json"
if [ -f "$TEMPLATE_PKG" ]; then
  # Use Node.js to safely modify JSON
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$TEMPLATE_PKG', 'utf8'));

    // Set template variables
    pkg.name = '{{projectName}}';
    pkg.version = '0.1.0';
    pkg.description = '{{projectDescription}}';

    // Remove monorepo-specific fields
    delete pkg.repository;
    delete pkg.homepage;
    delete pkg.bugs;
    delete pkg.author;
    delete pkg.license;

    // Remove monorepo-specific scripts
    delete pkg.scripts?.changeset;
    delete pkg.scripts?.['changeset:version'];
    delete pkg.scripts?.['changeset:publish'];

    // Remove monorepo-specific devDependencies
    delete pkg.devDependencies?.['@changesets/cli'];
    delete pkg.devDependencies?.['@commitlint/cli'];
    delete pkg.devDependencies?.['@commitlint/config-conventional'];
    delete pkg.devDependencies?.husky;
    delete pkg.devDependencies?.['lint-staged'];

    fs.writeFileSync('$TEMPLATE_PKG', JSON.stringify(pkg, null, 2) + '\n');
    console.log('Updated package.json with template variables');
  "
fi

echo ""
echo -e "${GREEN}Sync complete!${NC}"

# Show diff summary
echo ""
echo "Files synced:"
find "$TEMPLATE_DIR" -type f | wc -l | xargs echo "  Total files:"
