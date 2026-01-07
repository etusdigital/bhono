#!/bin/bash
# Agent Validation Script
# Validates agent YAML frontmatter and structure
#
# Usage: ./validate_agent.sh <agent-file>
# Example: ./validate_agent.sh .claude/agents/security-auditor.md

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <agent-file>"
    echo "Example: $0 .claude/agents/security-auditor.md"
    exit 1
fi

AGENT_FILE=$1

if [[ ! -f "$AGENT_FILE" ]]; then
    echo -e "${RED}Error: File '$AGENT_FILE' not found${NC}"
    exit 1
fi

echo -e "${BLUE}Validating agent: $AGENT_FILE${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Extract YAML frontmatter
FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$AGENT_FILE" | sed '1d;$d')

if [[ -z "$FRONTMATTER" ]]; then
    echo -e "${RED}✗ Error: No YAML frontmatter found${NC}"
    echo "  Expected format:"
    echo "  ---"
    echo "  name: agent-name"
    echo "  description: ..."
    echo "  ---"
    ((ERRORS++))
    exit 1
fi

# Validate required fields
NAME=$(echo "$FRONTMATTER" | grep "^name:" | cut -d: -f2- | sed 's/^ *//;s/ *$//')
DESCRIPTION=$(echo "$FRONTMATTER" | grep "^description:" | cut -d: -f2- | sed 's/^ *//;s/ *$//')
TOOLS=$(echo "$FRONTMATTER" | grep "^tools:" | cut -d: -f2- | sed 's/^ *//;s/ *$//')
MODEL=$(echo "$FRONTMATTER" | grep "^model:" | cut -d: -f2- | sed 's/^ *//;s/ *$//')

# Check name
if [[ -z "$NAME" ]]; then
    echo -e "${RED}✗ Error: Missing required field 'name'${NC}"
    ((ERRORS++))
else
    if [[ ! "$NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
        echo -e "${RED}✗ Error: Invalid name format '$NAME'${NC}"
        echo "  Name must be lowercase with hyphens (e.g., 'security-auditor')"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓ Name: $NAME${NC}"
    fi
fi

# Check description
if [[ -z "$DESCRIPTION" ]]; then
    echo -e "${RED}✗ Error: Missing required field 'description'${NC}"
    ((ERRORS++))
else
    if [[ ${#DESCRIPTION} -lt 20 ]]; then
        echo -e "${YELLOW}⚠ Warning: Description is very short (${#DESCRIPTION} chars)${NC}"
        echo "  Consider adding more detail for better auto-triggering"
        ((WARNINGS++))
    fi

    if [[ ! "$DESCRIPTION" =~ PROACTIVELY ]]; then
        echo -e "${YELLOW}⚠ Warning: Description doesn't contain 'PROACTIVELY'${NC}"
        echo "  Add 'Use PROACTIVELY for...' to enable automatic invocation"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✓ Description includes 'PROACTIVELY'${NC}"
    fi

    if [[ ${#DESCRIPTION} -gt 300 ]]; then
        echo -e "${YELLOW}⚠ Warning: Description is very long (${#DESCRIPTION} chars)${NC}"
        echo "  Consider keeping under 200 chars for better matching"
        ((WARNINGS++))
    fi

    echo -e "${GREEN}✓ Description length: ${#DESCRIPTION} chars${NC}"
fi

# Check tools (optional)
if [[ -n "$TOOLS" ]]; then
    VALID_TOOLS="Read|Write|Edit|Bash|MultiEdit|NotebookEdit|Grep|Glob|WebFetch|WebSearch"
    IFS=',' read -ra TOOL_ARRAY <<< "$TOOLS"

    INVALID_TOOLS=()
    for tool in "${TOOL_ARRAY[@]}"; do
        tool=$(echo "$tool" | sed 's/^ *//;s/ *$//')
        if [[ ! "$tool" =~ ^($VALID_TOOLS)$ ]]; then
            INVALID_TOOLS+=("$tool")
        fi
    done

    if [[ ${#INVALID_TOOLS[@]} -gt 0 ]]; then
        echo -e "${RED}✗ Error: Invalid tools: ${INVALID_TOOLS[*]}${NC}"
        echo "  Valid tools: Read, Write, Edit, Bash, MultiEdit, NotebookEdit, Grep, Glob, WebFetch, WebSearch"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓ Tools: $TOOLS${NC}"
    fi
else
    echo -e "${BLUE}ℹ Tools not specified (will inherit all tools)${NC}"
fi

# Check model (optional)
if [[ -n "$MODEL" ]]; then
    if [[ ! "$MODEL" =~ ^(haiku|sonnet|opus|inherit)$ ]]; then
        echo -e "${RED}✗ Error: Invalid model '$MODEL'${NC}"
        echo "  Valid models: haiku, sonnet, opus, inherit"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓ Model: $MODEL${NC}"
    fi
else
    echo -e "${BLUE}ℹ Model not specified (will default to sonnet)${NC}"
fi

# Check system prompt structure
SYSTEM_PROMPT=$(sed -n '/^---$/,/^---$/!p' "$AGENT_FILE" | tail -n +2)

if [[ -z "$SYSTEM_PROMPT" ]]; then
    echo -e "${RED}✗ Error: No system prompt found after frontmatter${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✓ System prompt present${NC}"

    # Check for recommended sections
    if echo "$SYSTEM_PROMPT" | grep -q "## Focus Areas"; then
        echo -e "${GREEN}✓ Has 'Focus Areas' section${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: Missing 'Focus Areas' section${NC}"
        ((WARNINGS++))
    fi

    if echo "$SYSTEM_PROMPT" | grep -q "## Approach"; then
        echo -e "${GREEN}✓ Has 'Approach' section${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: Missing 'Approach' section${NC}"
        ((WARNINGS++))
    fi

    if echo "$SYSTEM_PROMPT" | grep -q "## Output"; then
        echo -e "${GREEN}✓ Has 'Output' section${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: Missing 'Output' section${NC}"
        ((WARNINGS++))
    fi
fi

# Summary
echo ""
echo "========================================="
if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}✓ Validation passed! No issues found.${NC}"
elif [[ $ERRORS -eq 0 ]]; then
    echo -e "${YELLOW}⚠ Validation passed with $WARNINGS warning(s)${NC}"
else
    echo -e "${RED}✗ Validation failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    exit 1
fi

echo ""
echo "To test your agent:"
echo "  1. Save file to .claude/agents/$NAME.md"
echo "  2. Invoke: 'Use the $NAME to...'"
echo "  3. Test auto-triggering by using keywords from description"
