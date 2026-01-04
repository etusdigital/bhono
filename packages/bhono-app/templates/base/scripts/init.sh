#!/bin/bash

# BHono - Development Environment Setup
# Bootstraps dependencies, configures Cloudflare bindings,
# seeds the local D1 (sqlite) database, and starts the dev server.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

UPDATE_PACKAGES=0
SKIP_DEV=0
SKIP_PROVISION=0
SKIP_SEED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --update)
      UPDATE_PACKAGES=1
      ;;
    --skip-dev)
      SKIP_DEV=1
      ;;
    --no-provision)
      SKIP_PROVISION=1
      ;;
    --skip-seed)
      SKIP_SEED=1
      ;;
    *)
      echo -e "${YELLOW}Ignoring unknown argument: $1${NC}"
      ;;
  esac
  shift
 done

log_info() { echo -e "${BLUE}$*${NC}"; }
log_ok() { echo -e "${GREEN}$*${NC}"; }
log_warn() { echo -e "${YELLOW}$*${NC}"; }
log_err() { echo -e "${RED}$*${NC}"; }

log_info "========================================"
log_info "  BHono - Dev Environment Setup         "
log_info "========================================"

# Check for required tools
log_info "Checking required tools..."

if ! command -v node >/dev/null 2>&1; then
  log_err "Error: Node.js is not installed"
  log_err "Install Node.js 18+ from https://nodejs.org/"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  log_warn "pnpm not found. Installing..."
  npm install -g pnpm
fi

NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])")
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  log_err "Error: Node.js 18+ is required (found v${NODE_MAJOR})"
  exit 1
fi

log_ok "Node.js $(node -v) detected"
log_ok "pnpm $(pnpm -v) detected"

# Install dependencies
log_info "Installing dependencies..."
pnpm install

if [[ "$UPDATE_PACKAGES" -eq 1 ]]; then
  log_info "Updating dependencies..."
  pnpm update
fi

# Check for .env files
if [[ ! -f .env && -f .env.example ]]; then
  log_info "Creating .env from .env.example..."
  cp .env.example .env
  log_warn "Update .env with real values (GOOGLE_CLIENT_ID/SECRET, JWT_SECRET, SENDGRID_API_KEY)."
fi

if [[ ! -f .dev.vars && -f .dev.vars.example ]]; then
  log_info "Creating .dev.vars from .dev.vars.example..."
  cp .dev.vars.example .dev.vars
fi

# Determine project name
PROJECT_NAME_RAW=$(node -e "
const fs = require('fs');
const path = require('path');
let name = '';
try { name = JSON.parse(fs.readFileSync('etus.config.json','utf8')).name || ''; } catch (e) {}
if (!name) { try { name = JSON.parse(fs.readFileSync('package.json','utf8')).name || ''; } catch (e) {} }
if (!name) name = path.basename(process.cwd());
console.log(name);
" 2>/dev/null || echo "")

PROJECT_NAME="${PROJECT_NAME_RAW##*/}"
PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+|-+$//g')
if [[ -z "$PROJECT_NAME" ]]; then
  PROJECT_NAME=$(basename "$ROOT_DIR" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+|-+$//g')
fi

log_ok "Project name: $PROJECT_NAME"

# Ensure wrangler.json exists
if [[ ! -f config/wrangler.json ]]; then
  log_err "Missing config/wrangler.json"
  exit 1
fi

# Update wrangler.json placeholders
PROJECT_NAME="$PROJECT_NAME" node - <<'NODE'
const fs = require('fs');
const path = 'config/wrangler.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const projectName = process.env.PROJECT_NAME || '';

function replacePlaceholders(value) {
  if (typeof value === 'string') {
    return value.split('{{projectName}}').join(projectName);
  }
  if (Array.isArray(value)) {
    return value.map(replacePlaceholders);
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = replacePlaceholders(value[key]);
    }
    return value;
  }
  return value;
}

replacePlaceholders(data);
if (!data.name || data.name.includes('{{projectName}}')) {
  data.name = projectName;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
NODE

WRANGLER="pnpm exec wrangler"
WRANGLER_CONFIG="$WRANGLER --config config/wrangler.json"
WRANGLER_AVAILABLE=1
if ! $WRANGLER --version >/dev/null 2>&1; then
  WRANGLER_AVAILABLE=0
  log_warn "Wrangler not available. Cloudflare steps will be skipped."
fi

# Resolve names from wrangler.json
DB_NAME=$(node -e "const c=require('./config/wrangler.json'); console.log((c.d1_databases&&c.d1_databases[0]&&c.d1_databases[0].database_name)||'');")
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="${PROJECT_NAME}-db"
fi

DB_BINDING=$(node -e "const c=require('./config/wrangler.json'); console.log((c.d1_databases&&c.d1_databases[0]&&c.d1_databases[0].binding)||'DB');")

R2_BUCKET=$(node -e "const c=require('./config/wrangler.json'); console.log((c.r2_buckets&&c.r2_buckets[0]&&c.r2_buckets[0].bucket_name)||'');")
if [[ -z "$R2_BUCKET" ]]; then
  R2_BUCKET="${PROJECT_NAME}-storage"
fi

KV_NAME="${PROJECT_NAME}-sessions"

# Read existing IDs from wrangler.json (if present)
D1_ID=$(node -e "const c=require('./config/wrangler.json'); console.log((c.d1_databases&&c.d1_databases[0]&&c.d1_databases[0].database_id)||'');")
KV_ID=$(node -e "const c=require('./config/wrangler.json'); console.log((c.kv_namespaces&&c.kv_namespaces[0]&&c.kv_namespaces[0].id)||'');")
if [[ "$D1_ID" == "TO_BE_PROVISIONED" ]]; then D1_ID=""; fi
if [[ "$KV_ID" == "TO_BE_PROVISIONED" ]]; then KV_ID=""; fi

if [[ "$SKIP_PROVISION" -eq 0 && "$WRANGLER_AVAILABLE" -eq 1 ]]; then
  if $WRANGLER whoami >/dev/null 2>&1; then
    log_info "Provisioning Cloudflare resources (D1, KV, R2)..."

    # D1
    D1_LIST=$($WRANGLER d1 list --json || echo '[]')
    D1_ID=$(node -e "const fs=require('fs'); const list=JSON.parse(fs.readFileSync(0,'utf8')||'[]'); const name=process.env.DB_NAME; const item=list.find(x=>x.name===name); console.log(item?.uuid||item?.id||'');" <<< "$D1_LIST")
    if [[ -z "$D1_ID" ]]; then
      D1_CREATE=$($WRANGLER d1 create "$DB_NAME" --json)
      D1_ID=$(node -e "const obj=JSON.parse(process.env.JSON||'{}'); console.log(obj.uuid||obj.id||'');" JSON="$D1_CREATE")
    fi

    # KV
    KV_LIST=$($WRANGLER kv namespace list --json || echo '[]')
    KV_ID=$(node -e "const fs=require('fs'); const list=JSON.parse(fs.readFileSync(0,'utf8')||'[]'); const name=process.env.KV_NAME; const item=list.find(x=>x.title===name||x.name===name); console.log(item?.id||'');" <<< "$KV_LIST")
    if [[ -z "$KV_ID" ]]; then
      KV_CREATE=$($WRANGLER kv namespace create "$KV_NAME" --json)
      KV_ID=$(node -e "const obj=JSON.parse(process.env.JSON||'{}'); console.log(obj.id||'');" JSON="$KV_CREATE")
    fi

    # R2
    R2_LIST=$($WRANGLER r2 bucket list --json || echo '[]')
    R2_EXISTS=$(node -e "const fs=require('fs'); const list=JSON.parse(fs.readFileSync(0,'utf8')||'[]'); const name=process.env.R2_NAME; const item=list.find(x=>x.name===name); console.log(item? 'yes':'no');" R2_NAME="$R2_BUCKET" <<< "$R2_LIST")
    if [[ "$R2_EXISTS" != "yes" ]]; then
      $WRANGLER r2 bucket create "$R2_BUCKET" >/dev/null
    fi

    log_ok "Cloudflare resources ready."
  else
    log_warn "Wrangler not logged in. Skipping remote provisioning."
  fi
fi

# If no remote IDs, generate local-only IDs for dev
if [[ -z "$D1_ID" ]]; then
  D1_ID=$(node -e "console.log(require('crypto').randomUUID())")
  log_warn "Using local D1 id: $D1_ID"
fi

if [[ -z "$KV_ID" ]]; then
  KV_ID=$(node -e "console.log(require('crypto').randomUUID())")
  log_warn "Using local KV id: $KV_ID"
fi

# Update wrangler.json with IDs
D1_ID="$D1_ID" KV_ID="$KV_ID" PROJECT_NAME="$PROJECT_NAME" node - <<'NODE'
const fs = require('fs');
const path = 'config/wrangler.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const d1Id = process.env.D1_ID || '';
const kvId = process.env.KV_ID || '';

if (Array.isArray(data.d1_databases) && data.d1_databases[0]) {
  data.d1_databases[0].database_id = d1Id;
}

if (Array.isArray(data.kv_namespaces) && data.kv_namespaces[0]) {
  data.kv_namespaces[0].id = kvId;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
NODE

# Generate Cloudflare types
log_info "Generating Cloudflare types..."
pnpm cf-typegen >/dev/null 2>&1 || log_warn "Skipping cf-typegen (wrangler not configured)"

# Ensure local D1 exists
log_info "Preparing local D1 database..."
if [[ "$WRANGLER_AVAILABLE" -eq 1 ]]; then
  $WRANGLER_CONFIG d1 execute "$DB_NAME" --local --command "SELECT 1;" >/dev/null 2>&1 || log_warn "Local D1 init failed (continuing)."
fi

# Apply schema.sql and seed
DB_BOOTSTRAP_OK=0
SEED_OK=0

if [[ "$WRANGLER_AVAILABLE" -eq 1 ]]; then
  log_info "Applying schema.sql to local D1..."
  if pnpm db:schema:local >/tmp/bhono-db-schema.log 2>&1; then
    DB_BOOTSTRAP_OK=1
  else
    log_warn "Schema apply failed."
    tail -n 20 /tmp/bhono-db-schema.log || true
  fi
else
  log_warn "Wrangler not available. Skipping schema apply."
fi

if [[ "$SKIP_SEED" -eq 0 ]]; then
  if [[ "$WRANGLER_AVAILABLE" -eq 1 ]]; then
    log_info "Seeding local D1..."
    if pnpm db:seed:local >/tmp/bhono-seed.log 2>&1; then
      SEED_OK=1
    else
      log_warn "Seed apply failed."
      tail -n 20 /tmp/bhono-seed.log || true
    fi
  else
    log_warn "Wrangler not available. Skipping seed apply."
  fi
else
  log_warn "Skipping seed step (--skip-seed)."
fi

rm -f /tmp/bhono-db-schema.log /tmp/bhono-seed.log >/dev/null 2>&1 || true

if [[ "$DB_BOOTSTRAP_OK" -eq 1 && ( "$SEED_OK" -eq 1 || "$SKIP_SEED" -eq 1 ) ]]; then
  log_ok "Local D1 ready with schema${SKIP_SEED:+ (seed skipped)}."
else
  log_warn "Local D1 setup incomplete. Review warnings above."
fi

log_info "Seed data is defined in src/server/db/seed.ts (customize as needed)."

if [[ "$SKIP_DEV" -eq 0 ]]; then
  log_info "Starting dev server..."
  pnpm dev
else
  log_ok "Setup complete. Run 'pnpm dev' to start the server."
fi
