#!/bin/bash

# Hono Multi-Tenant SaaS Boilerplate - Development Environment Setup
# This script initializes the development environment for future coding agents

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Hono Boilerplate - Dev Environment   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for required tools
echo -e "${YELLOW}Checking required tools...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing...${NC}"
    npm install -g pnpm
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ is required (found v${NODE_VERSION})${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js $(node -v) detected${NC}"
echo -e "${GREEN}pnpm $(pnpm -v) detected${NC}"

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
pnpm install

# Check for .env file
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo ""
        echo -e "${YELLOW}Creating .env from .env.example...${NC}"
        cp .env.example .env
        echo -e "${YELLOW}Please update .env with your actual values:${NC}"
        echo "  - GOOGLE_CLIENT_ID"
        echo "  - GOOGLE_CLIENT_SECRET"
        echo "  - JWT_SECRET (min 32 chars)"
        echo "  - SENDGRID_API_KEY"
    else
        echo -e "${YELLOW}Warning: No .env file found. Create one based on required environment variables.${NC}"
    fi
fi

# Generate Cloudflare types
echo ""
echo -e "${YELLOW}Generating Cloudflare types...${NC}"
pnpm cf-typegen 2>/dev/null || echo -e "${YELLOW}Skipping cf-typegen (wrangler not configured)${NC}"

# Run database migrations (local)
echo ""
echo -e "${YELLOW}Running database migrations...${NC}"
pnpm db:migrate:local 2>/dev/null || echo -e "${YELLOW}Skipping migrations (D1 not available locally)${NC}"

# Seed database (optional)
echo ""
echo -e "${YELLOW}Do you want to seed the database with test data? (y/n)${NC}"
read -r -t 10 SEED_RESPONSE || SEED_RESPONSE="n"
if [[ "$SEED_RESPONSE" =~ ^[Yy]$ ]]; then
    pnpm db:seed 2>/dev/null || echo -e "${YELLOW}Skipping seed (D1 not available locally)${NC}"
fi

# Run tests to verify setup
echo ""
echo -e "${YELLOW}Running tests to verify setup...${NC}"
pnpm test:run --reporter=dot 2>/dev/null || echo -e "${YELLOW}Tests skipped (run 'pnpm test' manually)${NC}"

# Print summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Environment Setup Complete!          ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo ""
echo -e "  ${GREEN}pnpm dev${NC}               Start development server (Vite + Wrangler)"
echo -e "  ${GREEN}pnpm build${NC}             Build for production"
echo -e "  ${GREEN}pnpm deploy${NC}            Deploy to Cloudflare Workers"
echo ""
echo -e "  ${GREEN}pnpm db:migrate:local${NC}  Apply migrations locally"
echo -e "  ${GREEN}pnpm db:migrate:remote${NC} Apply migrations to production"
echo -e "  ${GREEN}pnpm db:seed${NC}           Seed test data"
echo ""
echo -e "  ${GREEN}pnpm test${NC}              Run unit tests (watch mode)"
echo -e "  ${GREEN}pnpm test:run${NC}          Run unit tests (single run)"
echo -e "  ${GREEN}pnpm test:e2e${NC}          Run Playwright E2E tests"
echo -e "  ${GREEN}pnpm test:e2e:ui${NC}       Run E2E tests with interactive UI"
echo -e "  ${GREEN}pnpm test:coverage${NC}     Generate coverage report"
echo ""
echo -e "  ${GREEN}pnpm lint${NC}              Run ESLint"
echo -e "  ${GREEN}pnpm cf-typegen${NC}        Generate Cloudflare types"
echo ""
echo -e "${BLUE}Access the application:${NC}"
echo ""
echo -e "  Local dev server:     ${GREEN}http://localhost:5173${NC}"
echo -e "  API documentation:    ${GREEN}http://localhost:5173/api/swagger${NC}"
echo -e "  OpenAPI JSON:         ${GREEN}http://localhost:5173/api/doc${NC}"
echo -e "  Health check:         ${GREEN}http://localhost:5173/health${NC}"
echo ""
echo -e "${YELLOW}To start development, run:${NC}"
echo -e "  ${GREEN}pnpm dev${NC}"
echo ""
