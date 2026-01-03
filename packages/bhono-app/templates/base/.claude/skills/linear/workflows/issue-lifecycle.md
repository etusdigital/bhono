# Issue Lifecycle Workflow

Complete workflow guide for managing Linear issues from triage to completion.

## Status Lifecycle

```
┌─────────┐    ┌─────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
│ Triage  │───▶│ Backlog │───▶│   Todo    │───▶│In Progress│───▶│ In Review │───▶│   Done   │
└─────────┘    └─────────┘    └───────────┘    └───────────┘    └───────────┘    └──────────┘
     │              │              │                │                 │                │
     │              ▼              │                │                 │                │
     │         ┌─────────┐        │                │                 │                │
     │         │ Icebox  │        │                │                 │                │
     │         └─────────┘        │                │                 │                │
     ▼              ▼              ▼                ▼                 ▼                │
┌────────────────────────────────────────────────────────────────────────────────┐    │
│                              Canceled / Duplicate                               │◀───┘
└────────────────────────────────────────────────────────────────────────────────┘
```

## Workflow Stages

### 1. Triage (type: `triage`)

**When**: Issue is newly created and awaiting review.

**Actions**:
- Review issue description and requirements
- Assess priority and effort
- Assign to appropriate team/project
- Move to Backlog or Todo

### 2. Backlog (type: `backlog`)

**When**: Issue is prioritized but not scheduled.

**Actions**:
- Refine requirements if needed
- Estimate effort
- Schedule for upcoming sprint/cycle

### 2b. Icebox (type: `backlog`)

**When**: Issue is valid but deferred indefinitely.

**Actions**:
- Add comment explaining why it's being iceboxed
- Review periodically during planning sessions

```bash
ICEBOX=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "Icebox") | .id')
npx tsx scripts/comments/create.ts ABC-123 "Moving to Icebox: Lower priority, will revisit in Q2" --json
npx tsx scripts/status/update.ts ABC-123 "$ICEBOX" --json
```

### 3. Todo (type: `unstarted`)

**When**: Issue is ready to be picked up.

**Actions**:
- Self-assign or get assigned
- Review acceptance criteria
- Prepare to start work

### 4. In Progress (type: `started`)

**When**: Actively working on the issue.

**Actions required upon starting**:
```bash
cd .claude/skills/linear

# Get current user
ME=$(npx tsx scripts/users/me.ts --json | jq -r '.id')

# Get "In Progress" state (use name for precision)
STATES=$(npx tsx scripts/status/list.ts --json)
IN_PROGRESS=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "In Progress") | .id')

# Update issue
npx tsx scripts/issues/update.ts --issue ABC-123 --assignee "$ME" --json
npx tsx scripts/status/update.ts ABC-123 "$IN_PROGRESS" --json
```

### 5. In Review (type: `started`)

**When**: Work is complete and awaiting review.

**Actions**:
- Code review requested
- PR submitted
- Awaiting approval

```bash
IN_REVIEW=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "In Review") | .id')
npx tsx scripts/status/update.ts ABC-123 "$IN_REVIEW" --json
```

### 6. Done (type: `completed`)

**When**: Work is complete and verified.

**Actions required before marking done**:
1. Verify all acceptance criteria met
2. Check related issues
3. Add completion documentation
4. Update status

## Completion Checklist

Before marking ANY issue as Done, verify:

- [ ] **Code complete**: All implementation finished
- [ ] **Tests passing**: Unit/integration tests green
- [ ] **Documentation**: Code comments where needed
- [ ] **Related issues checked**: Parent, siblings, children reviewed
- [ ] **Completion comment added**: Summary of changes

## Completion Comment Template

```markdown
## Completion Summary

**Status**: ✅ COMPLETED

### Changes Made
- `path/to/file.ts`: Brief description of changes
- `path/to/another.ts`: Brief description of changes

### Features Implemented
- Feature 1: What it does
- Feature 2: What it does

### Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Edge cases verified

### Next Steps (if any)
- Follow-up task description
- Configuration required
- Related work to schedule

### Related Issues
- Parent: ABC-100 (if applicable)
- Subtasks: ABC-101, ABC-102 (if applicable)
```

## Related Issue Management

### Working on Subtasks

When completing a subtask:

1. **Update the subtask** with completion comment
2. **Check sibling subtasks**: Are others complete?
3. **Update parent issue**:
   - If all subtasks done → Mark parent Done
   - If partial → Update parent with progress comment

```bash
# Get parent issue details
npx tsx scripts/issues/get.ts ABC-100 --json

# Add progress comment to parent
npx tsx scripts/comments/create.ts ABC-100 "Subtask ABC-101 completed. 2/3 subtasks done." --json
```

### Completing Parent Issues

When all subtasks are complete:

```bash
# Add summary comment
npx tsx scripts/comments/create.ts ABC-100 "$(cat <<'EOF'
## All Subtasks Completed

**Status**: ✅ COMPLETED

### Completed Subtasks
- ABC-101: Feature A implementation
- ABC-102: Feature B implementation
- ABC-103: Testing and documentation

### Summary
All acceptance criteria met. Feature ready for release.
EOF
)" --json

# Update status
DONE=$(npx tsx scripts/status/list.ts --json | jq -r '.statuses[] | select(.type == "completed") | .id' | head -1)
npx tsx scripts/status/update.ts ABC-100 $DONE --json
```

## Documentation Quality Examples

### Good Documentation

```markdown
## Completion Summary

**Status**: ✅ COMPLETED

### Changes Made
- `src/auth/oauth.ts`: Implemented OAuth 2.1 PKCE flow with state validation
- `src/auth/tokens.ts`: Added secure token storage with encryption
- `tests/auth/oauth.test.ts`: 12 unit tests covering happy path and edge cases

### Features Implemented
- OAuth authorization with PKCE challenge
- Automatic token refresh before expiry
- Secure token storage in encrypted format
- Error handling with user-friendly messages

### Testing
- [x] Unit tests (12 passing)
- [x] Integration test with mock OAuth server
- [x] Manual testing with Google OAuth

### Configuration Required
Set environment variables:
- `OAUTH_CLIENT_ID`
- `OAUTH_REDIRECT_URI`
```

### Poor Documentation

```
Done.
```

```
Fixed the bug.
```

```
Implemented feature.
```

**Why this matters**: Poor documentation creates confusion about what was delivered and makes it hard to debug issues later.

## Edge Cases

### Blocked Issues

If an issue is blocked:

1. Add comment explaining the blocker
2. Create linked blocking issue if needed
3. Keep status as In Progress or move to Backlog
4. Do NOT mark as Done

```bash
npx tsx scripts/comments/create.ts ABC-123 "Blocked by: Need API credentials from external team. Created follow-up ABC-124." --json
```

### Reopened Issues

If a completed issue needs more work:

1. Move back to In Progress
2. Add comment explaining why reopened
3. Follow normal completion flow when done again

### Canceled Issues

When canceling:

1. Add comment explaining why
2. Move to Canceled status
3. Update any parent issues

```bash
CANCELED=$(npx tsx scripts/status/list.ts --json | jq -r '.statuses[] | select(.type == "canceled") | .id' | head -1)
npx tsx scripts/comments/create.ts ABC-123 "Canceled: Requirements changed, no longer needed." --json
npx tsx scripts/status/update.ts ABC-123 $CANCELED --json
```

## Quick Reference Commands

```bash
cd .claude/skills/linear

# Get statuses (run once, reuse $STATES)
STATES=$(npx tsx scripts/status/list.ts --json)

# Start work on issue
ME=$(npx tsx scripts/users/me.ts --json | jq -r '.id')
IN_PROGRESS=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "In Progress") | .id')
npx tsx scripts/issues/update.ts --issue ABC-123 --assignee "$ME" --json
npx tsx scripts/status/update.ts ABC-123 "$IN_PROGRESS" --json

# Move to review
IN_REVIEW=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "In Review") | .id')
npx tsx scripts/status/update.ts ABC-123 "$IN_REVIEW" --json

# Complete issue
DONE=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "Done") | .id')
npx tsx scripts/comments/create.ts ABC-123 "Completion summary here..." --json
npx tsx scripts/status/update.ts ABC-123 "$DONE" --json

# Move to icebox
ICEBOX=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "Icebox") | .id')
npx tsx scripts/comments/create.ts ABC-123 "Moving to Icebox: reason..." --json
npx tsx scripts/status/update.ts ABC-123 "$ICEBOX" --json

# Cancel issue
CANCELED=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "Canceled") | .id')
npx tsx scripts/comments/create.ts ABC-123 "Reason for cancellation..." --json
npx tsx scripts/status/update.ts ABC-123 "$CANCELED" --json

# Mark as duplicate
DUPLICATE=$(echo "$STATES" | jq -r '.statuses[] | select(.name == "Duplicate") | .id')
npx tsx scripts/comments/create.ts ABC-123 "Duplicate of ABC-100" --json
npx tsx scripts/status/update.ts ABC-123 "$DUPLICATE" --json
```
