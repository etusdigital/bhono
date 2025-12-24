# Implement Linear Issue

Implement a Linear issue following the complete workflow from the linear skill.

**Usage:** `/linear:implement-issue <issue-identifier>`
**Example:** `/linear:implement-issue AA-1395`

---

## Phase 1: Issue Retrieval

First, fetch the issue details from Linear:

```bash
cd .claude/skills/linear
npx tsx scripts/issues/get.ts $ARGUMENTS --json
```

Parse and understand:
- **Title**: What is the issue about?
- **Description**: Full requirements and acceptance criteria
- **Status**: Current state (should be Triage, Backlog, or Todo)
- **Priority**: How urgent is this?
- **Parent**: Is this a subtask of a larger issue?
- **Children**: Does this have subtasks?

**STOP and analyze the issue before proceeding.**

---

## Phase 2: Start Work

Update the issue status and assign yourself:

```bash
cd .claude/skills/linear

# Get your user ID
ME=$(npx tsx scripts/users/me.ts --json | jq -r '.id')

# Get available statuses
STATES=$(npx tsx scripts/status/list.ts --json)

# Get "In Progress" status ID
IN_PROGRESS=$(echo $STATES | jq -r '.statuses[] | select(.name == "In Progress") | .id')

# Assign yourself (if not already assigned)
npx tsx scripts/issues/update.ts --issue $ARGUMENTS --assignee $ME --json

# Update status to "In Progress"
npx tsx scripts/status/update.ts $ARGUMENTS $IN_PROGRESS --json
```

**CRITICAL**: Never start implementation without updating the status first.

---

## Phase 3: Analysis & Planning

Before writing any code:

1. **Understand the requirements** - Read the issue description carefully
2. **Check the codebase** - Look for existing patterns, related code
3. **Assess complexity**:
   - Simple (1-2 files): Proceed directly
   - Medium (3-5 files): Create a mental plan
   - Complex (6+ files or architectural): Consider breaking into subtasks

4. **For complex issues**, consider:
   - Breaking down into smaller Linear issues
   - Running parallel agents (up to 10) for independent tasks
   - Creating an implementation plan before coding

---

## Phase 4: Implementation

Execute the work required by the issue.

**Guidelines:**
- Follow existing code patterns in the codebase
- Write tests if appropriate
- Keep changes focused on the issue scope
- Document complex logic with comments

**For parallel work** (complex issues):
```
Use the Task tool to spawn multiple agents for independent subtasks.
Each agent should handle a specific, well-defined piece of work.
Maximum 10 parallel agents.
```

---

## Phase 5: Verification

Before marking the issue as complete:

### 5.1 Check Related Issues

**If this is a subtask:**
```bash
# Get parent issue to check sibling status
npx tsx scripts/issues/get.ts <PARENT-ID> --json
```
- Are all sibling subtasks complete?
- Should the parent be updated?

**If this has subtasks:**
```bash
# List children issues
# Check if all children are complete before completing parent
```

### 5.2 Verify Acceptance Criteria

- [ ] All requirements from the description are met
- [ ] Code works as expected
- [ ] No regressions introduced
- [ ] Tests pass (if applicable)

---

## Phase 6: Documentation

**CRITICAL**: Add a completion comment following documentation standards.

### Completion Comment Template

```bash
cd .claude/skills/linear

npx tsx scripts/comments/create.ts $ARGUMENTS "$(cat <<'EOF'
## Completion Summary

**Status**: ✅ COMPLETED

### Changes Made
- `path/to/file1.ts`: Brief description of changes
- `path/to/file2.ts`: Brief description of changes

### Features Implemented
- Feature 1: What it does
- Feature 2: What it does

### Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed

### Next Steps (if any)
- Follow-up task description
- Configuration required
EOF
)" --json
```

### Documentation Quality Rules

| Quality | Example |
|---------|---------|
| ✅ Good | Detailed completion with files, features, implementation notes |
| ❌ Poor | "Done." or "Fixed the bug." |

**NEVER complete an issue with poor documentation.**

---

## Phase 7: Complete the Issue

Update the status to "Done":

```bash
cd .claude/skills/linear

STATES=$(npx tsx scripts/status/list.ts --json)
DONE=$(echo $STATES | jq -r '.statuses[] | select(.name == "Done") | .id')

npx tsx scripts/status/update.ts $ARGUMENTS $DONE --json
```

### If Moving to Review Instead

For issues requiring code review:

```bash
IN_REVIEW=$(echo $STATES | jq -r '.statuses[] | select(.name == "In Review") | .id')
npx tsx scripts/status/update.ts $ARGUMENTS $IN_REVIEW --json
```

---

## Parent Issue Updates

When completing the LAST subtask of a parent issue:

1. Add summary comment to parent:
```bash
npx tsx scripts/comments/create.ts <PARENT-ID> "$(cat <<'EOF'
## All Subtasks Completed

**Status**: ✅ COMPLETED

### Completed Subtasks
- $ARGUMENTS: Brief summary of this subtask
- <OTHER-ID>: Brief summary
- <OTHER-ID>: Brief summary

### Summary
All acceptance criteria met. Feature ready for release.
EOF
)" --json
```

2. Update parent status to "Done":
```bash
DONE=$(echo $STATES | jq -r '.statuses[] | select(.name == "Done") | .id')
npx tsx scripts/status/update.ts <PARENT-ID> $DONE --json
```

---

## Quick Reference: Status Commands

```bash
cd .claude/skills/linear
STATES=$(npx tsx scripts/status/list.ts --json)

# Status IDs
IN_PROGRESS=$(echo $STATES | jq -r '.statuses[] | select(.name == "In Progress") | .id')
IN_REVIEW=$(echo $STATES | jq -r '.statuses[] | select(.name == "In Review") | .id')
DONE=$(echo $STATES | jq -r '.statuses[] | select(.name == "Done") | .id')
ICEBOX=$(echo $STATES | jq -r '.statuses[] | select(.name == "Icebox") | .id')
CANCELED=$(echo $STATES | jq -r '.statuses[] | select(.name == "Canceled") | .id')
```

---

## Checklist

Before finishing this command, verify:

- [ ] Issue status updated to "In Progress" at start
- [ ] All requirements implemented
- [ ] Related issues checked (parent/siblings/children)
- [ ] Completion comment added with documentation standards
- [ ] Issue status updated to "Done" (or "In Review")

**Remember**: An issue is NOT complete until Linear reflects its completion.
