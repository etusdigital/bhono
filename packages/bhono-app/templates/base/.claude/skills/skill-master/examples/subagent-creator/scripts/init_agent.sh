#!/bin/bash
# Agent Initialization Script
# Creates a new agent configuration from a template
#
# Usage: ./init_agent.sh <domain> <agent-name> [model]
#
# Domains: development-team, security, data-ai, database, devops-infrastructure, etc.
# Models: sonnet (default), opus, haiku
# Example: ./init_agent.sh security custom-auditor opus

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLES_DIR="$SCRIPT_DIR/../assets/examples"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 <domain> <agent-name> [model]"
    echo ""
    echo "Domains:"
    echo "  development-team        - Full-stack, frontend, backend developers"
    echo "  security                - Security auditors, pentesters"
    echo "  data-ai                 - ML engineers, data scientists"
    echo "  database                - Database architects, query optimizers"
    echo "  devops-infrastructure   - DevOps, cloud, infrastructure"
    echo "  performance-testing     - Performance engineers, load testing"
    echo "  documentation           - Technical writers"
    echo "  api-graphql             - API designers, GraphQL specialists"
    echo "  ...and 16 more domains"
    echo ""
    echo "Models:"
    echo "  haiku   - Fast, for simple/frequent tasks"
    echo "  sonnet  - Balanced, for most development (default)"
    echo "  opus    - Complex analysis and architecture"
    echo ""
    echo "Example:"
    echo "  $0 security my-auditor opus"
    echo "  $0 development-team my-developer"
    exit 1
}

list_templates() {
    local domain=$1
    local domain_dir="$EXAMPLES_DIR/$domain"

    if [[ ! -d "$domain_dir" ]]; then
        echo -e "${RED}Error: Domain '$domain' not found${NC}"
        exit 1
    fi

    echo -e "${GREEN}Available templates in '$domain':${NC}"
    find "$domain_dir" -name "*.md" -exec basename {} .md \; | sort
}

# Parse arguments
if [[ $# -lt 2 ]]; then
    usage
fi

DOMAIN=$1
AGENT_NAME=$2
MODEL=${3:-sonnet}

# Validate domain
if [[ ! -d "$EXAMPLES_DIR/$DOMAIN" ]]; then
    echo -e "${RED}Error: Invalid domain '$DOMAIN'${NC}"
    echo ""
    echo "Available domains:"
    ls -1 "$EXAMPLES_DIR" | head -20
    echo "...and more"
    exit 1
fi

# Validate model
if [[ ! "$MODEL" =~ ^(haiku|sonnet|opus)$ ]]; then
    echo -e "${RED}Error: Invalid model '$MODEL'. Must be haiku, sonnet, or opus${NC}"
    exit 1
fi

# List available templates for reference
echo -e "${YELLOW}Available templates in domain '$DOMAIN':${NC}"
list_templates "$DOMAIN"
echo ""

# Prompt for template selection
echo -e "${YELLOW}Enter template name to base your agent on (or 'custom' for blank template):${NC}"
read -r TEMPLATE_NAME

if [[ "$TEMPLATE_NAME" == "custom" ]]; then
    # Create blank template
    AGENT_CONTENT=$(cat <<EOF
---
name: $AGENT_NAME
description: Brief description of agent specialty. Use PROACTIVELY for task1, task2, and task3.
tools: Read, Write, Edit, Bash
model: $MODEL
---

You are a [role] specializing in [domain].

## Focus Areas
- Area 1
- Area 2
- Area 3

## Approach
1. Step 1
2. Step 2
3. Step 3

## Output
- Deliverable 1
- Deliverable 2
- Deliverable 3

Focus on [key principle].
EOF
)
else
    # Check if template exists
    TEMPLATE_PATH="$EXAMPLES_DIR/$DOMAIN/$TEMPLATE_NAME.md"
    if [[ ! -f "$TEMPLATE_PATH" ]]; then
        echo -e "${RED}Error: Template '$TEMPLATE_NAME.md' not found${NC}"
        exit 1
    fi

    # Read template and customize
    AGENT_CONTENT=$(cat "$TEMPLATE_PATH")

    # Ask if user wants to customize name and model
    echo -e "${BLUE}Customize template? (y/N):${NC}"
    read -r CUSTOMIZE

    if [[ "$CUSTOMIZE" =~ ^[Yy]$ ]]; then
        # Extract original name from template
        ORIG_NAME=$(grep "^name:" "$TEMPLATE_PATH" | cut -d: -f2 | tr -d ' ')

        # Replace name and model in content
        AGENT_CONTENT=$(echo "$AGENT_CONTENT" | sed "s/^name: $ORIG_NAME/name: $AGENT_NAME/")
        AGENT_CONTENT=$(echo "$AGENT_CONTENT" | sed "s/^model: .*/model: $MODEL/")
    fi
fi

# Determine output path
OUTPUT_DIR=".claude/agents"
OUTPUT_PATH="$OUTPUT_DIR/$AGENT_NAME.md"

# Create directory if it doesn't exist
if [[ ! -d "$OUTPUT_DIR" ]]; then
    mkdir -p "$OUTPUT_DIR"
    echo -e "${GREEN}Created directory: $OUTPUT_DIR${NC}"
fi

# Check if file already exists
if [[ -f "$OUTPUT_PATH" ]]; then
    echo -e "${YELLOW}Warning: Agent '$AGENT_NAME' already exists at $OUTPUT_PATH${NC}"
    echo -e "${YELLOW}Overwrite? (y/N):${NC}"
    read -r OVERWRITE

    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Printing agent content instead:${NC}"
        echo ""
        echo "$AGENT_CONTENT"
        exit 0
    fi
fi

# Write agent file
echo "$AGENT_CONTENT" > "$OUTPUT_PATH"

echo ""
echo -e "${GREEN}✓ Created agent at: $OUTPUT_PATH${NC}"
echo ""
echo -e "${BLUE}Agent details:${NC}"
echo "  Name: $AGENT_NAME"
echo "  Model: $MODEL"
echo "  Path: $OUTPUT_PATH"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Edit $OUTPUT_PATH to customize the agent"
echo "2. Update the description with PROACTIVELY keywords"
echo "3. Adjust tools based on required access level"
echo "4. Test by invoking: 'Use the $AGENT_NAME to...'"
echo ""
echo -e "${BLUE}To validate your agent:${NC}"
echo "  bash scripts/validate_agent.sh $OUTPUT_PATH"
