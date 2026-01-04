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
DEV_PORT=""
GOOGLE_CLIENT_ID_ARG=""
GOOGLE_CLIENT_SECRET_ARG=""

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
    --port)
      DEV_PORT="$2"
      shift
      ;;
    --port=*)
      DEV_PORT="${1#*=}"
      ;;
    --google-id)
      GOOGLE_CLIENT_ID_ARG="$2"
      shift
      ;;
    --google-id=*)
      GOOGLE_CLIENT_ID_ARG="${1#*=}"
      ;;
    --google-secret)
      GOOGLE_CLIENT_SECRET_ARG="$2"
      shift
      ;;
    --google-secret=*)
      GOOGLE_CLIENT_SECRET_ARG="${1#*=}"
      ;;
    --help|-h)
      echo ""
      echo "BHono - Development Environment Setup"
      echo ""
      echo "Usage: ./scripts/init.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --port PORT           Set dev server port (default: 8787)"
      echo "  --google-id ID        Set Google OAuth Client ID"
      echo "  --google-secret SEC   Set Google OAuth Client Secret"
      echo "  --no-provision        Skip Cloudflare resource provisioning"
      echo "  --skip-dev            Don't start dev server after setup"
      echo "  --skip-seed           Skip database seeding"
      echo "  --update              Update dependencies"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./scripts/init.sh"
      echo "  ./scripts/init.sh --port 3000"
      echo "  ./scripts/init.sh --port 8787 --google-id 'xxx.apps.googleusercontent.com' --google-secret 'GOCSPX-xxx'"
      echo "  CLOUDFLARE_ACCOUNT_ID=xxx ./scripts/init.sh"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${YELLOW}Ignoring unknown argument: $1${NC}"
      ;;
  esac
  shift
 done

# Set default port if not specified
DEV_PORT="${DEV_PORT:-8787}"

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

# ============================================================================
# FIX PROJECT NAME IN ALL CONFIG FILES (handles "." issue from bhono-app)
# ============================================================================
log_info "Fixing project name in config files..."

# Fix package.json if name is "." or empty
if [[ -f package.json ]]; then
  PROJECT_NAME="$PROJECT_NAME" node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (pkg.name === '.' || pkg.name === '' || !pkg.name) {
      pkg.name = process.env.PROJECT_NAME;
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
      console.log('  Fixed package.json name');
    }
  " 2>/dev/null || true
fi

# Fix etus.config.json if name is "." or empty
if [[ -f etus.config.json ]]; then
  PROJECT_NAME="$PROJECT_NAME" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('etus.config.json', 'utf8'));
    if (data.name === '.' || data.name === '' || !data.name) {
      data.name = process.env.PROJECT_NAME;
      data.domain = process.env.PROJECT_NAME + '.com';
      fs.writeFileSync('etus.config.json', JSON.stringify(data, null, 2));
      console.log('  Fixed etus.config.json name');
    }
  " 2>/dev/null || true
fi

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

# ============================================================================
# FIX VITE.CONFIG.TS (configPath + server port)
# ============================================================================
log_info "Checking vite.config.ts..."

if [[ -f vite.config.ts ]]; then
  VITE_UPDATED=0

  # Add configPath to cloudflare plugin if not present
  if ! grep -q "configPath:" vite.config.ts; then
    sed -i.bak 's/cloudflare()/cloudflare({\n      configPath: ".\\/config\\/wrangler.json",\n    })/g' vite.config.ts
    rm -f vite.config.ts.bak
    VITE_UPDATED=1
    log_ok "  Added configPath to cloudflare plugin"
  fi

  # Add server port if not present
  if ! grep -q "server:" vite.config.ts; then
    sed -i.bak "s/export default defineConfig({/export default defineConfig({\n  server: {\n    port: $DEV_PORT,\n  },/g" vite.config.ts
    rm -f vite.config.ts.bak
    VITE_UPDATED=1
    log_ok "  Added server port $DEV_PORT"
  fi

  [[ "$VITE_UPDATED" -eq 0 ]] && log_ok "  vite.config.ts already configured"
fi

# ============================================================================
# CREATE/UPDATE CONFIG/.DEV.VARS
# ============================================================================
log_info "Checking config/.dev.vars..."

# Determine Google OAuth credentials
GOOGLE_ID="${GOOGLE_CLIENT_ID_ARG:-seu-google-client-id}"
GOOGLE_SECRET="${GOOGLE_CLIENT_SECRET_ARG:-seu-google-client-secret}"

if [[ ! -f config/.dev.vars ]]; then
  # Generate a random JWT secret
  JWT_RAND=$(openssl rand -hex 16 2>/dev/null || node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

  cat > config/.dev.vars << EOF
# Environment
ENVIRONMENT=development
APP_URL=http://localhost:$DEV_PORT

# JWT Configuration (IMPORTANTE: mínimo 32 caracteres)
JWT_SECRET=super-secret-jwt-key-with-at-least-32-chars-${JWT_RAND}
JWT_EXPIRY_MINUTES=15

# Google OAuth
GOOGLE_CLIENT_ID=$GOOGLE_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_SECRET
GOOGLE_REDIRECT_URI=http://localhost:$DEV_PORT/auth/callback

# Refresh Token
REFRESH_TOKEN_EXPIRY_DAYS=30

# SendGrid (opcional para desenvolvimento)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@example.com
EOF
  log_ok "  config/.dev.vars created"

  if [[ "$GOOGLE_ID" == "seu-google-client-id" ]]; then
    log_warn "  IMPORTANTE: Edite config/.dev.vars com suas credenciais Google OAuth!"
  else
    log_ok "  Google OAuth credentials configured"
  fi
else
  # Update Google credentials if provided via arguments
  if [[ -n "$GOOGLE_CLIENT_ID_ARG" ]]; then
    sed -i.bak "s|GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID_ARG|g" config/.dev.vars
    rm -f config/.dev.vars.bak
    log_ok "  Updated GOOGLE_CLIENT_ID"
  fi
  if [[ -n "$GOOGLE_CLIENT_SECRET_ARG" ]]; then
    sed -i.bak "s|GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET_ARG|g" config/.dev.vars
    rm -f config/.dev.vars.bak
    log_ok "  Updated GOOGLE_CLIENT_SECRET"
  fi

  # Ensure APP_URL is set for local development
  if ! grep -q "APP_URL=http://localhost" config/.dev.vars; then
    echo "" >> config/.dev.vars
    echo "# Added by init.sh" >> config/.dev.vars
    echo "APP_URL=http://localhost:$DEV_PORT" >> config/.dev.vars
    log_ok "  Added APP_URL to config/.dev.vars"
  fi

  # Update redirect URI if port changed
  if ! grep -q "GOOGLE_REDIRECT_URI=http://localhost:$DEV_PORT" config/.dev.vars; then
    sed -i.bak "s|GOOGLE_REDIRECT_URI=http://localhost:[0-9]*|GOOGLE_REDIRECT_URI=http://localhost:$DEV_PORT|g" config/.dev.vars
    rm -f config/.dev.vars.bak
  fi
fi

# ============================================================================
# UPDATE .GITIGNORE FOR SECURITY
# ============================================================================
log_info "Checking .gitignore..."

if [[ -f .gitignore ]]; then
  if ! grep -q "config/.dev.vars" .gitignore; then
    echo "config/.dev.vars" >> .gitignore
    log_ok "  Added config/.dev.vars to .gitignore"
  fi
fi

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

# ============================================================================
# SYNC DATABASES (handle plugin hash mismatch)
# ============================================================================
# The Cloudflare Vite plugin creates SQLite with a hash based on config,
# not the database_id. We need to sync all databases after seeding.
log_info "Synchronizing database files..."

SQLITE_DIR=".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
if [[ -d "$SQLITE_DIR" ]]; then
  SQLITE_FILES=$(find "$SQLITE_DIR" -name "*.sqlite" -not -name "*-shm" -not -name "*-wal" 2>/dev/null || true)
  if [[ -n "$SQLITE_FILES" ]]; then
    # Find the database with actual tables (largest file usually has data)
    MAIN_DB=$(ls -S $SQLITE_FILES 2>/dev/null | head -1)

    if [[ -n "$MAIN_DB" ]]; then
      # Check if main DB has tables
      HAS_TABLES=$(sqlite3 "$MAIN_DB" ".tables" 2>/dev/null | wc -w || echo "0")

      if [[ "$HAS_TABLES" -gt 0 ]]; then
        for DB in $SQLITE_FILES; do
          if [[ "$DB" != "$MAIN_DB" ]]; then
            cp "$MAIN_DB" "$DB" 2>/dev/null || true
          fi
        done
        log_ok "  Synced $(echo "$SQLITE_FILES" | wc -l | tr -d ' ') database files"
      else
        log_warn "  Main database has no tables. Skipping sync."
      fi
    fi
  fi
fi

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
