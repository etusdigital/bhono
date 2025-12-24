# Linear Operations - Quick Reference

## Command Summary

| Operation | Command (Named Flags - Recommended) |
|-----------|-------------------------------------|
| Create issue | `npx tsx scripts/issues/create.ts --title "title" [options] --json` |
| Update issue | `npx tsx scripts/issues/update.ts --issue ABC-123 [options] --json` |
| List issues | `npx tsx scripts/issues/list.ts [teamId] --json` |
| Get issue | `npx tsx scripts/issues/get.ts ABC-123 --json` |
| Archive issue | `npx tsx scripts/issues/archive.ts ABC-123 --json` |
| List teams | `npx tsx scripts/list-teams.ts --json` |
| List statuses | `npx tsx scripts/status/list.ts [teamId] --json` |
| Update status | `npx tsx scripts/status/update.ts ABC-123 <stateId> --json` |
| Create comment | `npx tsx scripts/comments/create.ts ABC-123 "text" --json` |
| List comments | `npx tsx scripts/comments/list.ts ABC-123 --json` |
| List labels | `npx tsx scripts/labels/list.ts [teamId] --json` |
| Create label | `npx tsx scripts/labels/create.ts "name" [teamId] --json` |
| Add label | `npx tsx scripts/labels/add-to-issue.ts ABC-123 <labelId> --json` |
| Current user | `npx tsx scripts/users/me.ts --json` |
| List users | `npx tsx scripts/users/list.ts [teamId] --json` |

## Create Issue Options

```bash
# Named flags (recommended)
npx tsx scripts/issues/create.ts --title "Issue title" [options] --json

# Legacy positional (backwards compatible)
npx tsx scripts/issues/create.ts "Issue title" [teamId] [options] --json
```

| Option | Type | Description |
|--------|------|-------------|
| `--title <text>` | String | Issue title (required) |
| `--teamId <id>` | ID | Team ID (optional if configured) |
| `--description <text>` | String | Issue description (markdown supported) |
| `--state <id>` | ID | Initial workflow state ID |
| `--priority <0-4>` | Int | Priority level |
| `--assignee <id>` | ID | User ID to assign |
| `--labels <ids>` | IDs | Comma-separated label IDs |
| `--project <id>` | ID | Project ID |
| `--estimate <points>` | Int | Point estimate |
| `--due <YYYY-MM-DD>` | Date | Due date |
| `--parent <id>` | ID | Parent issue ID or identifier (e.g., AA-123) for sub-issues |
| `--cycle <id>` | ID | Cycle/sprint ID |

## Update Issue Options

```bash
# Named flags (recommended)
npx tsx scripts/issues/update.ts --issue ABC-123 [options] --json

# Legacy positional (backwards compatible)
npx tsx scripts/issues/update.ts ABC-123 [options] --json
```

| Option | Type | Description |
|--------|------|-------------|
| `--issue <id>` | ID | Issue ID or identifier (required) |
| `--title <text>` | String | New title |
| `--description <text>` | String | New description (markdown) |
| `--state <id>` | ID | Workflow state ID |
| `--priority <0-4>` | Int | Priority level |
| `--assignee <id>` | ID/null | User ID (`none` to unassign) |
| `--labels <ids>` | IDs | Label IDs (replaces existing) |
| `--project <id>` | ID/null | Project ID (`none` to remove) |
| `--estimate <points>` | Int/null | Point estimate (`none` to clear) |
| `--due <YYYY-MM-DD>` | Date/null | Due date (`none` to clear) |
| `--parent <id>` | ID/null | Parent issue ID or identifier (e.g., AA-123) (`none` to remove) |
| `--cycle <id>` | ID/null | Cycle/sprint ID (`none` to remove) |

## Priority Levels

- `0` - No priority
- `1` - Urgent (🔴)
- `2` - High (🟠)
- `3` - Medium (🟡)
- `4` - Low (🔵)

## Mentions & Embeds

Use URLs in description fields - Linear auto-converts them:

| Type | Format | Result |
|------|--------|--------|
| User mention | `https://linear.app/workspace/profiles/username` | @username |
| Issue mention | `https://linear.app/workspace/issue/AA-123` | Clickable AA-123 |
| YouTube | `https://www.youtube.com/watch?v=...` | Embedded video |
| Figma | `https://www.figma.com/file/...` | Embedded design |
| Loom | `https://www.loom.com/share/...` | Embedded video |

**Note:** `@username` syntax only works in UI, not API. Use profile URLs.

## Common JQ Patterns

```bash
# Extract team ID by name
jq -r '.teams[] | select(.name == "Engineering") | .id'

# Extract issue IDs
jq -r '.issues[].id'

# Filter urgent issues
jq '.issues[] | select(.priority == 1)'

# Count issues
jq '.issues | length'

# Get first team
jq -r '.teams[0].id'

# Extract identifier (AA-123)
jq -r '.identifier'

# Get status name
jq -r '.status'
```

## Bash Patterns

```bash
# Store result in variable
RESULT=$(npx tsx scripts/issues/list.ts --json)

# Extract field
TEAM_ID=$(echo $RESULT | jq -r '.teams[0].id')

# Loop through items
for ID in $(echo $RESULT | jq -r '.issues[].id'); do
  # do something with $ID
done

# Conditional execution (named flags)
if npx tsx scripts/issues/create.ts --title "Bug fix" --json; then
  echo "Success"
fi

# Chain commands
TEAM_ID=$(npx tsx scripts/list-teams.ts --json | jq -r '.teams[0].id') && \
npx tsx scripts/issues/list.ts $TEAM_ID --json

# Create and update issue
ISSUE=$(npx tsx scripts/issues/create.ts --title "New task" --json)
ISSUE_ID=$(echo $ISSUE | jq -r '.identifier')
npx tsx scripts/issues/update.ts --issue $ISSUE_ID --priority 2 --json
```

## Typical Response Structures

**Teams:**
```json
{
  "teams": [
    {"id": "uuid", "name": "Engineering", "key": "ENG"}
  ],
  "projects": [
    {"id": "uuid", "name": "Q1 Project", "teamId": "uuid"}
  ]
}
```

**Issues:**
```json
{
  "issues": [
    {
      "id": "uuid",
      "identifier": "ENG-123",
      "title": "Bug fix",
      "status": "In Progress",
      "priority": 1,
      "priorityLabel": "Urgent",
      "url": "https://linear.app/..."
    }
  ]
}
```

**Issue Details:**
```json
{
  "id": "uuid",
  "identifier": "ENG-123",
  "title": "Bug fix",
  "description": "Full description...",
  "status": "In Progress",
  "priority": 1,
  "priorityLabel": "Urgent",
  "assignee": {"id": "...", "name": "...", "email": "..."},
  "creator": {"id": "...", "name": "...", "email": "..."},
  "url": "https://linear.app/...",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-02T00:00:00.000Z"
}
```

**Statuses:**
```json
{
  "statuses": [
    {
      "id": "uuid",
      "name": "In Progress",
      "type": "started",
      "color": "#f2c94c",
      "position": 2
    }
  ]
}
```

**Comments:**
```json
{
  "comments": [
    {
      "id": "uuid",
      "body": "Comment text",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "user": {"id": "...", "name": "...", "email": "..."}
    }
  ]
}
```

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| LINEAR_API_KEY not found | No credentials | Run `npx tsx scripts/setup-credentials.ts` |
| Module not found | Missing dependencies | Run `npm install` |
| Issue not found | Invalid ID | Check issue ID/identifier |
| Team not found | Invalid team ID | Use `list-teams.ts` to get valid IDs |
| Permission denied | File permissions | Run `chmod 600 ~/.linear/credentials` |

## Authentication Locations

Priority order (first found is used):

1. **Environment variable:** `$LINEAR_API_KEY`
2. **User credentials:** `~/.linear/credentials`
3. **Project .env:** `.env` in project root

## File Structure

```
.
├── scripts/
│   ├── issues/       # Issue operations
│   ├── comments/     # Comment operations
│   ├── status/       # Status operations
│   ├── labels/       # Label operations
│   └── users/        # User operations
├── scripts/
│   └── setup-credentials.ts  # Setup wizard
├── lib/
│   ├── client.ts    # Linear client
│   └── output.ts    # Output formatting
├── list-teams.ts    # List teams/projects
└── get-issues.ts    # Get issues (legacy)
```
