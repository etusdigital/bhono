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
# First, clean up files that should never be in template
echo "Cleaning up old files..."
rm -rf "$TEMPLATE_DIR/.husky" \
       "$TEMPLATE_DIR/.test-output" \
       "$TEMPLATE_DIR/.github" \
       "$TEMPLATE_DIR/docs/plans" \
       "$TEMPLATE_DIR/docs/ets" \
       "$TEMPLATE_DIR/docs/openapi.json" \
       "$TEMPLATE_DIR/tests/e2e/.auth" \
       "$TEMPLATE_DIR/commitlint.config.js" \
       "$TEMPLATE_DIR/lint-staged.config.js" \
       "$TEMPLATE_DIR/pnpm-lock.yaml" \
       "$TEMPLATE_DIR/auth-setup-error.png" \
       2>/dev/null || true

# Remove tsbuildinfo files (wildcard doesn't work in rm)
find "$TEMPLATE_DIR" -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true

# Remove all tmp directories
find "$TEMPLATE_DIR" -type d -name "tmp" -exec rm -rf {} + 2>/dev/null || true

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
  --exclude='.github/' \
  --exclude='docs/plans/' \
  --exclude='docs/ets/' \
  --exclude='.claude/settings.local.json' \
  --exclude='.agents/' \
  --exclude='.codex/' \
  --exclude='AGENTS.md' \
  --exclude='coverage/' \
  --exclude='test-results/' \
  --exclude='playwright-report/' \
  --exclude='.wrangler/' \
  --exclude='worker-configuration.d.ts' \
  --exclude='.test-output/' \
  --exclude='*.tsbuildinfo' \
  --exclude='commitlint.config.js' \
  --exclude='lint-staged.config.js' \
  --exclude='.husky/' \
  --exclude='scripts/sync-template.sh' \
  --exclude='auth-setup-error.png' \
  --exclude='*.png' \
  --exclude='tmp/' \
  --exclude='**/tmp/' \
  --exclude='docs/openapi.json' \
  --exclude='tests/e2e/.auth/' \
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

# Reset deploy-specific values in template's wrangler.json. Root keeps the
# real values for the boilerplate's own deploy; template ships the generic
# placeholders documented in CLAUDE.md ("admin@etus.com.br" — each product
# must replace before deploying). Without this, every sync would leak the
# root operator's email into the template.
TEMPLATE_WRANGLER="$TEMPLATE_DIR/config/wrangler.json"
if [ -f "$TEMPLATE_WRANGLER" ]; then
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('$TEMPLATE_WRANGLER', 'utf8'));
    const PLACEHOLDER = 'admin@etus.com.br';
    if (cfg.vars && cfg.vars.ETUS_ADMIN_EMAILS) {
      cfg.vars.ETUS_ADMIN_EMAILS = PLACEHOLDER;
    }
    for (const envName of Object.keys(cfg.env ?? {})) {
      const envBlock = cfg.env[envName];
      if (envBlock.vars && envBlock.vars.ETUS_ADMIN_EMAILS) {
        envBlock.vars.ETUS_ADMIN_EMAILS = PLACEHOLDER;
      }
    }
    fs.writeFileSync('$TEMPLATE_WRANGLER', JSON.stringify(cfg, null, 2) + '\n');
    console.log('Reset wrangler.json ETUS_ADMIN_EMAILS to template placeholder');
  "
fi

echo ""
echo -e "${GREEN}Sync complete!${NC}"

# Show diff summary
echo ""
echo "Files synced:"
find "$TEMPLATE_DIR" -type f | wc -l | xargs echo "  Total files:"
