---
name: linear
description: Manages Linear issues, teams, and workflows via TypeScript CLI scripts. Use when user mentions Linear, issues, teams, projects, status, labels, or comments. Executes scripts that return JSON output for parsing.
---

# Linear

Execute Linear operations via TypeScript CLI scripts with JSON output.

## When to Use

Activate when user requests:
- Creating, updating, or archiving issues
- Listing or filtering teams, projects, or issues
- Managing status, priority, labels, or assignments
- Adding or viewing comments

**Trigger keywords**: Linear, issue, team, project, status, label, comment, priority

## Quick Start

```bash
cd .claude/skills/linear

# Create issue (named flags - recommended)
npx tsx scripts/issues/create.ts --title "Bug fix" --description "Details here" --json

# List issues
npx tsx scripts/issues/list.ts --json

# Update issue
npx tsx scripts/issues/update.ts --issue ABC-123 --title "New title" --priority 2 --json
```

## Argument Styles

Scripts support **two argument styles**:

### Named Flags (Recommended)

More readable, self-documenting, order doesn't matter:

```bash
npx tsx scripts/issues/create.ts --title "My Issue" --description "Details" --priority 2 --json
npx tsx scripts/issues/update.ts --issue ABC-123 --title "Updated" --priority 1 --json
```

### Positional (Legacy)

Shorter but order-dependent:

```bash
npx tsx scripts/issues/create.ts "My Issue" "team-uuid" --description "Details" --json
npx tsx scripts/issues/update.ts ABC-123 --title "Updated" --json
```

**Always use named flags for complex operations with descriptions.**

## Configuration

Scripts auto-load defaults from `.claude/linear-config.json`:

```bash
# With config: teamId auto-filled
npx tsx scripts/issues/create.ts --title "Bug fix" --json

# Without config: must specify teamId
npx tsx scripts/issues/create.ts --title "Bug fix" --teamId "uuid" --json
```

**Setup config**: Run `/linear:setup` to create defaults.

## Authentication

Credentials loaded automatically (priority order):
1. `LINEAR_API_KEY` environment variable
2. `~/.linear/credentials` file
3. `.env` file in project root

**Setup credentials**:
```bash
cd .claude/skills/linear && npx tsx scripts/setup/setup-credentials.ts
```

## Core Commands

### Issues

**Create issue:**
```bash
npx tsx scripts/issues/create.ts --title "Issue title" [options] --json
```

Options:
| Option | Description |
|--------|-------------|
| `--title <text>` | Issue title (required) |
| `--teamId <id>` | Team ID (optional if configured) |
| `--description <text>` | Issue description (markdown) |
| `--state <id>` | Initial workflow state ID |
| `--priority <0-4>` | 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low |
| `--assignee <id>` | User ID to assign |
| `--labels <ids>` | Comma-separated label IDs |
| `--project <id>` | Project ID |
| `--estimate <points>` | Point estimate |
| `--due <YYYY-MM-DD>` | Due date |
| `--parent <id>` | Parent issue ID or identifier (e.g., AA-123) for sub-issues |
| `--cycle <id>` | Cycle/sprint ID |

**List issues:**
```bash
npx tsx scripts/issues/list.ts [teamId] --json
```

**Get issue details:**
```bash
npx tsx scripts/issues/get.ts ABC-123 --json
```

**Update issue:**
```bash
npx tsx scripts/issues/update.ts --issue ABC-123 [options] --json
```

Options:
| Option | Description |
|--------|-------------|
| `--issue <id>` | Issue ID or identifier (required) |
| `--title <text>` | New title |
| `--description <text>` | New description (markdown) |
| `--state <id>` | Workflow state ID |
| `--priority <0-4>` | Priority level |
| `--assignee <id>` | User ID (`none` to unassign) |
| `--labels <ids>` | Label IDs (replaces existing) |
| `--project <id>` | Project ID (`none` to remove) |
| `--estimate <points>` | Point estimate (`none` to clear) |
| `--due <YYYY-MM-DD>` | Due date (`none` to clear) |
| `--parent <id>` | Parent issue ID or identifier (e.g., AA-123) (`none` to remove) |
| `--cycle <id>` | Cycle/sprint ID (`none` to remove) |

**Archive issue:**
```bash
npx tsx scripts/issues/archive.ts ABC-123 --json
```

### Teams & Projects

```bash
npx tsx scripts/list-teams.ts --json
```

### Status

**List workflow states:**
```bash
npx tsx scripts/status/list.ts [teamId] --json
```

**Update status by name (RECOMMENDED):**
```bash
npx tsx scripts/status/set-by-name.ts ABC-123 "Done" --json
npx tsx scripts/status/set-by-name.ts ABC-123 "In Progress" --json
```

**Update status by ID (legacy):**
```bash
npx tsx scripts/status/update.ts ABC-123 <stateId> --json
```

### Comments

**Add comment:**
```bash
npx tsx scripts/comments/create.ts ABC-123 "Comment text" --json
```

**List comments:**
```bash
npx tsx scripts/comments/list.ts ABC-123 --json
```

### Labels

**List labels:**
```bash
npx tsx scripts/labels/list.ts [teamId] --json
```

**Create label:**
```bash
npx tsx scripts/labels/create.ts "bug" [teamId] [color] --json
```

**Add to issue:**
```bash
npx tsx scripts/labels/add-to-issue.ts ABC-123 <labelId> --json
```

### Users

```bash
npx tsx scripts/users/me.ts --json
npx tsx scripts/users/list.ts [teamId] --json
```

## Common Workflows

### Create Issue with Full Details

```bash
cd .claude/skills/linear

npx tsx scripts/issues/create.ts \
  --title "Epic: New Feature" \
  --description "## Overview

Description with markdown support.

## Tasks
- [ ] Task 1
- [ ] Task 2" \
  --priority 2 \
  --json
```

### Create and Label Issue

```bash
cd .claude/skills/linear

# Create issue
ISSUE=$(npx tsx scripts/issues/create.ts --title "Bug: Login broken" --json)
ISSUE_ID=$(echo "$ISSUE" | jq -r '.id')

# Get label ID
LABELS=$(npx tsx scripts/labels/list.ts --json)
LABEL_ID=$(echo "$LABELS" | jq -r '.labels[] | select(.name == "bug") | .id')

# Add label
npx tsx scripts/labels/add-to-issue.ts $ISSUE_ID $LABEL_ID --json
```

### Update Status

```bash
cd .claude/skills/linear

# Update status by name (RECOMMENDED - no jq needed)
npx tsx scripts/status/set-by-name.ts ABC-123 "In Progress" --json
npx tsx scripts/status/set-by-name.ts ABC-123 "Done" --json

# Legacy: Get state ID and update (requires jq)
# STATES=$(npx tsx scripts/status/list.ts --json)
# IN_PROGRESS=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "In Progress") | .id')
# npx tsx scripts/status/update.ts ABC-123 $IN_PROGRESS --json
```

## Issue Workflow

**CRITICAL**: When working on Linear issues, follow this lifecycle to maintain consistency.

### Starting Work on an Issue

1. **Update status to "In Progress"**:
   ```bash
   cd .claude/skills/linear
   npx tsx scripts/status/set-by-name.ts ABC-123 "In Progress" --json
   ```

2. **Assign yourself** (if unassigned):
   ```bash
   cd .claude/skills/linear
   ME=$(npx tsx scripts/users/me.ts --json | jq -r '.id')
   npx tsx scripts/issues/update.ts --issue ABC-123 --assignee $ME --json
   ```

### Moving to Review

When work is ready for review:
```bash
cd .claude/skills/linear
npx tsx scripts/status/set-by-name.ts ABC-123 "In Review" --json
```

### Moving to Icebox

For issues to defer indefinitely:
```bash
cd .claude/skills/linear
npx tsx scripts/status/set-by-name.ts ABC-123 "Icebox" --json
```

### Completing an Issue

**Before marking any issue done:**

1. **Check related issues**:
   - Parent issues (if working on subtasks)
   - Sibling issues (other subtasks in same parent)
   - Child issues (if completing a parent task)

2. **Add completion comment** with:
   - Summary of what was done
   - Files created/modified with descriptions
   - Features implemented
   - Next steps or configuration requirements

3. **Update status to "Done"**:
   ```bash
   cd .claude/skills/linear
   npx tsx scripts/status/set-by-name.ts ABC-123 "Done" --json
   ```

### Documentation Standards

Every completed issue must have a comment like:

```markdown
## Completion Summary

**Status**: ✅ COMPLETED

### Changes Made
- `src/feature.ts`: Added new feature implementation
- `tests/feature.test.ts`: Added unit tests

### Features Implemented
- Feature 1: Description
- Feature 2: Description

### Next Steps (if any)
- Follow-up task 1
- Configuration needed
```

### Parent Issue Updates

When all subtasks of a parent issue are complete:
1. Mark all acceptance criteria as completed `[x]`
2. Add summary referencing all completed subtask IDs
3. Update parent status to "Done"

### Documentation Quality

| Quality | Example |
|---------|---------|
| ✅ Good | Detailed completion with files, features, implementation notes |
| ❌ Poor | Just marked Done without explanation |

**See also:** `workflows/issue-lifecycle.md` for detailed workflow documentation.

## Output Format

- **With `--json`**: Pure JSON, ready for parsing
- **Without `--json`**: Formatted with colors (human-readable)

**Always use `--json` for agent operations.**

## Best Practices

1. **Use named flags** for create/update operations
2. **Always append `--json`** for parseable output
3. **Run `/linear:setup`** once to configure defaults
4. **Quote arguments** with spaces or special characters
5. **Parse with jq** for reliable extraction

## Mentions & Embeds

Linear automatically converts URLs in descriptions to mentions and embeds.

### User Mentions

Use the profile URL format (not `@username`):

```bash
npx tsx scripts/issues/create.ts \
  --title "Review needed" \
  --description "https://linear.app/your-workspace/profiles/username please review" \
  --json
```

Linear converts `https://linear.app/.../profiles/username` → `@username`

### Issue Mentions

Use the issue URL:

```bash
npx tsx scripts/issues/create.ts \
  --title "Follow-up" \
  --description "Related to https://linear.app/your-workspace/issue/AA-123" \
  --json
```

Linear converts the URL → clickable `AA-123` link

### Embeds

Paste URLs directly - Linear auto-embeds supported platforms:

| Platform | Example |
|----------|---------|
| YouTube | `https://www.youtube.com/watch?v=...` |
| Figma | `https://www.figma.com/file/...` |
| Loom | `https://www.loom.com/share/...` |
| Descript | `https://share.descript.com/...` |

```bash
npx tsx scripts/issues/create.ts \
  --title "Design review" \
  --description "Review mockup: https://www.figma.com/file/abc123" \
  --json
```

## Slash Commands

- **`/linear:setup`** - Configure project defaults (team, project, auto-assign)
- **`/linear:create-issue`** - Interactive issue creation

## Setup

```bash
cd .claude/skills/linear
npm install
npx tsx scripts/setup/setup-credentials.ts
npx tsx scripts/list-teams.ts --json  # Test connection
```

## Additional Resources

- `reference.md` - API reference, JSON schemas, troubleshooting
- `examples.md` - Real-world workflow examples
- `templates/` - Issue template guide and examples:
  - `README.md` - Templates overview and best practices
  - `bug-report.md` - Bug report template with severity guidelines
  - `feature-request.md` - Feature request template with user stories
  - `tech-debt.md` - Technical debt template with migration patterns
  - `security-issue.md` - Security vulnerability template (CVSS, disclosure)
  - `sprint-task.md` - Sprint task template with estimation guides
  - `api-reference.md` - Using templates via the Linear API
