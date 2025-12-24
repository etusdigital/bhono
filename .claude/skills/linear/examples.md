# Linear Operations - Examples

## Example 1: Create Issue and Move to In Progress

**User request:** "Create a bug issue and move it to In Progress"

**Execution:**
```bash
# Get team ID
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[] | select(.name == "Engineering") | .id')

# Create issue
RESULT=$(npx tsx scripts/issues/create.ts "Bug: Login broken" "$TEAM_ID" "Users cannot authenticate" --json)
ISSUE_ID=$(echo "$RESULT" | jq -r '.id')

# Get "In Progress" status ID
STATUSES=$(npx tsx scripts/status/list.ts "$TEAM_ID" --json)
STATE_ID=$(echo "$STATUSES" | jq -r '.statuses[] | select(.name == "In Progress") | .id')

# Update issue status
npx tsx scripts/status/update.ts "$ISSUE_ID" "$STATE_ID" --json
```

**Response:** "Created issue ENG-124 and moved to In Progress"

---

## Example 2: List Urgent Issues

**User request:** "Show me all urgent issues"

**Execution:**
```bash
# Get team ID
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[0].id')

# Get all issues
ISSUES=$(npx tsx scripts/issues/list.ts "$TEAM_ID" --json)

# Filter urgent (priority 1)
echo "$ISSUES" | jq '.issues[] | select(.priority == 1)'
```

**Response:** Display filtered list with identifiers, titles, and status

---

## Example 3: Add Comments to Multiple Issues

**User request:** "Add status update comment to all issues in Todo"

**Execution:**
```bash
# Get team and issues
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[0].id')
ISSUES=$(npx tsx scripts/issues/list.ts "$TEAM_ID" --json)

# Get Todo issue IDs
TODO_IDS=$(echo "$ISSUES" | jq -r '.issues[] | select(.status == "Todo") | .id')

# Add comment to each
for ISSUE_ID in $TODO_IDS; do
  npx tsx scripts/comments/create.ts "$ISSUE_ID" "Status update: reviewing next sprint" --json
done
```

**Response:** "Added comments to 5 Todo issues"

---

## Example 4: Create Issue with Label

**User request:** "Create a feature request and tag it"

**Execution:**
```bash
# Get team
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[0].id')

# Create issue
RESULT=$(npx tsx scripts/issues/create.ts "Feature: Dark mode" "$TEAM_ID" "Add dark mode support" --json)
ISSUE_ID=$(echo "$RESULT" | jq -r '.id')

# Get or create "feature" label
LABELS=$(npx tsx scripts/labels/list.ts "$TEAM_ID" --json)
LABEL_ID=$(echo "$LABELS" | jq -r '.labels[] | select(.name == "feature") | .id')

# If label doesn't exist, create it
if [ -z "$LABEL_ID" ]; then
  LABEL_RESULT=$(npx tsx scripts/labels/create.ts "feature" "$TEAM_ID" "#0000ff" --json)
  LABEL_ID=$(echo "$LABEL_RESULT" | jq -r '.id')
fi

# Add label to issue
npx tsx scripts/labels/add-to-issue.ts "$ISSUE_ID" "$LABEL_ID" --json
```

**Response:** "Created issue ENG-125 with 'feature' label"

---

## Example 5: Bulk Status Update

**User request:** "Move all 'Backlog' issues to 'Todo'"

**Execution:**
```bash
# Get team and statuses
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[0].id')
STATUSES=$(npx tsx scripts/status/list.ts "$TEAM_ID" --json)
TODO_STATE=$(echo "$STATUSES" | jq -r '.statuses[] | select(.name == "Todo") | .id')

# Get backlog issues
ISSUES=$(npx tsx scripts/issues/list.ts "$TEAM_ID" --json)
BACKLOG_IDS=$(echo "$ISSUES" | jq -r '.issues[] | select(.status == "Backlog") | .id')

# Update each
COUNT=0
for ISSUE_ID in $BACKLOG_IDS; do
  npx tsx scripts/status/update.ts "$ISSUE_ID" "$TODO_STATE" --json
  COUNT=$((COUNT + 1))
done

echo "Updated $COUNT issues from Backlog to Todo"
```

**Response:** "Updated 12 issues from Backlog to Todo"

---

## Example 6: Issue Report

**User request:** "Give me a summary of issues by status"

**Execution:**
```bash
# Get issues
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[0].id')
ISSUES=$(npx tsx scripts/issues/list.ts "$TEAM_ID" --json)

# Count by status
TODO=$(echo "$ISSUES" | jq '[.issues[] | select(.status == "Todo")] | length')
IN_PROGRESS=$(echo "$ISSUES" | jq '[.issues[] | select(.status == "In Progress")] | length')
DONE=$(echo "$ISSUES" | jq '[.issues[] | select(.status == "Done")] | length')

echo "Issue Summary:"
echo "- Todo: $TODO"
echo "- In Progress: $IN_PROGRESS"
echo "- Done: $DONE"
```

**Response:**
```
Issue Summary:
- Todo: 15
- In Progress: 8
- Done: 42
```

---

## Example 7: Get Issue Details and Comments

**User request:** "Show me details and comments for AA-123"

**Execution:**
```bash
# Get issue details
ISSUE=$(npx tsx scripts/issues/get.ts AA-123 --json)

# Get comments
COMMENTS=$(npx tsx scripts/comments/list.ts "$(echo "$ISSUE" | jq -r '.id')" --json)

# Format output
echo "Issue: $(echo "$ISSUE" | jq -r '.title')"
echo "Status: $(echo "$ISSUE" | jq -r '.status')"
echo "Priority: $(echo "$ISSUE" | jq -r '.priorityLabel')"
echo ""
echo "Comments:"
echo "$COMMENTS" | jq -r '.comments[] | "- \(.user.name): \(.body)"'
```

**Response:**
```
Issue: Fix login bug
Status: In Progress
Priority: Urgent

Comments:
- John Doe: Working on this now
- Jane Smith: Found the root cause
```

---

## Example 8: Create Related Issues

**User request:** "Create a parent issue and 3 sub-tasks"

**Execution:**
```bash
# Get team
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[0].id')

# Create parent issue
PARENT=$(npx tsx scripts/issues/create.ts "Implement user dashboard" "$TEAM_ID" "Main dashboard feature" --json)
PARENT_ID=$(echo "$PARENT" | jq -r '.identifier')

# Create sub-tasks with reference to parent
npx tsx scripts/issues/create.ts "Design dashboard layout (subtask of $PARENT_ID)" "$TEAM_ID" --json
npx tsx scripts/issues/create.ts "Implement data fetching (subtask of $PARENT_ID)" "$TEAM_ID" --json
npx tsx scripts/issues/create.ts "Add user settings (subtask of $PARENT_ID)" "$TEAM_ID" --json
```

**Response:** "Created parent issue ENG-126 and 3 related subtasks"

---

## Example 9: Find and Update Issue

**User request:** "Find the login bug issue and mark it as urgent"

**Execution:**
```bash
# Get team and issues
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[0].id')
ISSUES=$(npx tsx scripts/issues/list.ts "$TEAM_ID" --json)

# Find issue with "login" in title
ISSUE_ID=$(echo "$ISSUES" | jq -r '.issues[] | select(.title | contains("login")) | .id' | head -1)

# Update priority to 1 (Urgent)
npx tsx scripts/issues/update.ts "$ISSUE_ID" --priority 1 --json
```

**Response:** "Found and marked issue ENG-115 as urgent"

---

## Example 10: Weekly Status Update

**User request:** "Add weekly status comment to all In Progress issues"

**Execution:**
```bash
# Get current date
DATE=$(date +"%Y-%m-%d")

# Get team and issues
TEAM_ID=$(npx tsx list-teams.ts --json | jq -r '.teams[0].id')
ISSUES=$(npx tsx scripts/issues/list.ts "$TEAM_ID" --json)

# Get In Progress issue IDs
IN_PROGRESS_IDS=$(echo "$ISSUES" | jq -r '.issues[] | select(.status == "In Progress") | .id')

# Add weekly update comment
for ISSUE_ID in $IN_PROGRESS_IDS; do
  npx tsx scripts/comments/create.ts "$ISSUE_ID" "Weekly update ($DATE): Still in progress" --json
done
```

**Response:** "Added weekly status to 8 In Progress issues"
