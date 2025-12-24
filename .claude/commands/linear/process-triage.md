# Process Triage Issues

Process all triage issues: classify, enrich, decompose, and move to Backlog or cancel if already implemented.

**Usage:** `/linear:process-triage`

**IMPORTANT**: Always use the project in the `.claude/linear-config.json` file to process the issues.

---

## Overview

This command processes all issues in Triage status by:

1. **Classifying** - Bug, Feature, Tech Debt, Security, Documentation
2. **Checking** - If already implemented or duplicate
3. **Enriching** - Adding acceptance criteria, labels, priority
4. **Decomposing** - Breaking complex issues into subtasks
5. **Moving** - To Backlog (valid) or Canceled (solved/invalid)

---

## Phase 1: Gather Triage Issues

List all issues and filter for Triage status:

```bash
cd .claude/skills/linear
npx tsx scripts/issues/list.ts --json
```

Filter the results for issues with `status == "Triage"`.

**Display summary:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 TRIAGE QUEUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found X issues in Triage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 2: Get Available Labels and Statuses

```bash
cd .claude/skills/linear

# Get labels for classification
npx tsx scripts/labels/list.ts --json

# Get statuses for transitions
STATES=$(npx tsx scripts/status/list.ts --json)
BACKLOG=$(echo $STATES | jq -r '.statuses[] | select(.name == "Backlog") | .id')
CANCELED=$(echo $STATES | jq -r '.statuses[] | select(.name == "Canceled") | .id')
DUPLICATE=$(echo $STATES | jq -r '.statuses[] | select(.name == "Duplicate") | .id')
```

---

## Phase 3: Process Each Issue

For each triage issue, perform the following analysis:

### 3.1 Get Full Issue Details

```bash
npx tsx scripts/issues/get.ts <ISSUE-ID> --json
```

### 3.2 Classify the Issue

Analyze the title and description to classify:

| Type              | Keywords                                       | Default Priority | Label           |
| ----------------- | ---------------------------------------------- | ---------------- | --------------- |
| **Bug**           | error, crash, broken, fix, fail, wrong, bug    | High (2)         | `bug`           |
| **Feature**       | add, implement, create, new, feature, enhance  | Medium (3)       | `feature`       |
| **Tech Debt**     | refactor, cleanup, improve, optimize, migrate  | Medium (3)       | `tech-debt`     |
| **Security**      | security, vulnerability, CVE, auth, permission | Urgent (1)       | `security`      |
| **Documentation** | docs, readme, document, guide, tutorial        | Low (4)          | `documentation` |

### 3.3 Check if Already Implemented

**Search the codebase:**

- Extract 3-5 keywords from issue title
- Use Grep to search for those keywords
- Check if the functionality/fix already exists

**Search git history:**

```bash
git log --oneline --grep="<ISSUE-ID>" --since="6 months ago"
git log --oneline --grep="<keyword>" --since="3 months ago"
```

**Evidence levels:**

- **HIGH**: Exact feature/fix found in code with matching functionality
- **MEDIUM**: Related code exists, may partially address issue
- **LOW**: Keywords found but unclear if issue is resolved

### 3.4 Assess Complexity

| Complexity  | Criteria                      | Effort | Action                      |
| ----------- | ----------------------------- | ------ | --------------------------- |
| **Simple**  | 1-2 files, clear scope        | S      | Enrich & move               |
| **Medium**  | 3-5 files, some ambiguity     | M      | Enrich & move               |
| **Complex** | 6+ files, architectural       | L      | Decompose first             |
| **Epic**    | Multiple features, major work | XL     | Decompose into 3-5 subtasks |

---

## Phase 4: Take Action

### Decision Tree

```
IF already implemented (HIGH confidence):
  → Cancel with evidence

ELSE IF duplicate of existing issue:
  → Cancel as Duplicate, link original

ELSE IF invalid/unclear:
  → Cancel with reason OR ask for clarification

ELSE IF complex (L/XL effort):
  → Decompose into subtasks
  → Enrich parent
  → Move parent to Backlog

ELSE:
  → Enrich issue
  → Move to Backlog
```

### 4.1 Cancel - Already Implemented

```bash
cd .claude/skills/linear

npx tsx scripts/comments/create.ts <ISSUE-ID> "$(cat <<'EOF'
## Issue Canceled: Already Implemented

**Reason**: This functionality already exists in the codebase.

### Evidence
- **File**: `path/to/file.ts`
- **Lines**: 123-145
- **Commit**: abc123 - "Added feature X"

### Verification
The requested feature/fix is working as expected. No action needed.
EOF
)" --json

npx tsx scripts/status/update.ts <ISSUE-ID> $CANCELED --json
```

### 4.2 Cancel - Duplicate

```bash
npx tsx scripts/comments/create.ts <ISSUE-ID> "$(cat <<'EOF'
## Issue Canceled: Duplicate

This issue duplicates **AA-XXX**.

Please follow the original issue for updates.
EOF
)" --json

npx tsx scripts/status/update.ts <ISSUE-ID> $DUPLICATE --json
```

### 4.3 Enrich and Move to Backlog

Update the issue with enriched information:

```bash
npx tsx scripts/issues/update.ts --issue <ISSUE-ID> \
  --description "$(cat <<'EOF'
## Original Request
[Original description preserved here]

---

## Triage Analysis

### Classification
- **Type**: [Bug/Feature/Tech Debt/Security/Docs]
- **Complexity**: [Simple/Medium/Complex]
- **Estimated Effort**: [S/M/L]

### Acceptance Criteria
- [ ] Criterion 1 based on requirements
- [ ] Criterion 2 based on requirements
- [ ] Criterion 3 based on requirements

### Technical Notes
[Notes from codebase analysis - relevant files, patterns, dependencies]

### Related Files
- `path/to/relevant/file1.ts`
- `path/to/relevant/file2.ts`

### Implementation Hints
[Suggested approach based on codebase patterns]
EOF
)" \
  --priority <PRIORITY> \
  --json

# Add appropriate label
npx tsx scripts/labels/add-to-issue.ts <ISSUE-ID> <LABEL-ID> --json

# Move to Backlog
npx tsx scripts/status/update.ts <ISSUE-ID> $BACKLOG --json
```

### 4.4 Decompose Complex Issues

For complex issues (L/XL effort), create subtasks:

```bash
# Create subtask 1
npx tsx scripts/issues/create.ts \
  --title "Subtask 1: [Specific task]" \
  --description "$(cat <<'EOF'
## Parent Issue
This is a subtask of **<PARENT-ID>**: [Parent Title]

## Scope
[Specific scope for this subtask]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
[Specific technical details for this subtask]
EOF
)" \
  --parent <PARENT-ID> \
  --priority <PRIORITY> \
  --json

# Repeat for additional subtasks...
```

After creating subtasks, update parent:

```bash
npx tsx scripts/issues/update.ts --issue <PARENT-ID> \
  --description "$(cat <<'EOF'
## Epic: [Original Title]

[Original description]

---

## Subtasks
- [ ] **<SUBTASK-1-ID>**: Subtask 1 title
- [ ] **<SUBTASK-2-ID>**: Subtask 2 title
- [ ] **<SUBTASK-3-ID>**: Subtask 3 title

## Completion Criteria
All subtasks must be completed before this epic is done.
EOF
)" --json

npx tsx scripts/status/update.ts <PARENT-ID> $BACKLOG --json
```

---

## Phase 5: Summary Report

After processing all issues, display summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TRIAGE PROCESSING COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Processed: XX

📦 Moved to Backlog: XX
   - AA-101: Issue title (Feature, M)
   - AA-102: Issue title (Bug, S)

❌ Canceled - Already Implemented: XX
   - AA-103: Issue title (found in src/x.ts)

🔄 Canceled - Duplicate: XX
   - AA-104: Issue title (dup of AA-050)

🔨 Decomposed into Subtasks: XX
   - AA-105: Epic title
     → AA-106, AA-107, AA-108

⚠️ Skipped - Needs Clarification: XX
   - AA-109: Unclear requirements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Issue Display Format

For each issue being processed, display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 AA-XXXX: Issue Title Here
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL: https://linear.app/...

📝 Description:
[First 200 chars of description...]

🏷️ Classification: [Type] | Priority: [P1-P4]
📐 Complexity: [Simple/Medium/Complex] | Effort: [S/M/L/XL]

🔍 Already Implemented Check:
   [x] Searched codebase for keywords
   [x] Checked git history
   Result: [Not found / Found in X]

🎯 Recommended Action: [Enrich & Move / Cancel / Decompose]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Best Practices

1. **Always preserve original description** - Add enrichments below, don't replace
2. **Be specific in acceptance criteria** - Vague criteria lead to vague implementations
3. **Link evidence when canceling** - File paths, commits, or duplicate issue IDs
4. **Create meaningful subtasks** - Each should be independently completable
5. **Set realistic priorities** - Not everything is urgent
6. **Add technical notes** - Help future implementers understand the codebase context

---

## Quick Reference

```bash
cd .claude/skills/linear

# Get triage issues
npx tsx scripts/issues/list.ts --json | jq '.issues[] | select(.status == "Triage")'

# Status IDs
STATES=$(npx tsx scripts/status/list.ts --json)
BACKLOG=$(echo $STATES | jq -r '.statuses[] | select(.name == "Backlog") | .id')
CANCELED=$(echo $STATES | jq -r '.statuses[] | select(.name == "Canceled") | .id')
DUPLICATE=$(echo $STATES | jq -r '.statuses[] | select(.name == "Duplicate") | .id')

# Update issue
npx tsx scripts/issues/update.ts --issue <ID> --description "..." --priority 2 --json

# Create subtask
npx tsx scripts/issues/create.ts --title "..." --parent <PARENT-ID> --json

# Add label
npx tsx scripts/labels/add-to-issue.ts <ISSUE-ID> <LABEL-ID> --json

# Move to status
npx tsx scripts/status/update.ts <ISSUE-ID> <STATUS-ID> --json

# Add comment
npx tsx scripts/comments/create.ts <ISSUE-ID> "comment" --json
```

---

## Checklist

For each triage issue, verify:

- [ ] Issue was fully read and understood
- [ ] Classification is accurate
- [ ] Codebase was searched for existing implementation
- [ ] Git history was checked
- [ ] Appropriate action was taken:
  - [ ] Enriched with acceptance criteria (if moving to Backlog)
  - [ ] Comment added explaining reason (if canceling)
  - [ ] Subtasks created (if decomposing)
- [ ] Status was updated in Linear
- [ ] Labels were added (if applicable)

**Remember**: A triaged issue should never be left ambiguous. Every issue moves forward with clear next steps.
