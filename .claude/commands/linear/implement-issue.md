# Implement Linear Issue

Implement a Linear issue with full git workflow: branch creation, commits, changesets (when needed), and PR creation.

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
- **Labels**: Type of work (feature, bug, chore, etc.)

**STOP and analyze the issue before proceeding.**

---

## Phase 2: Branch Creation

Create a feature branch linked to the issue:

### 2.1 Branch Naming Convention

Format: `<type>/<issue-id>-<short-description>`

| Issue Type | Branch Prefix |
|------------|---------------|
| Feature/Enhancement | `feat/` |
| Bug fix | `fix/` |
| Refactoring | `refactor/` |
| Documentation | `docs/` |
| Tests | `test/` |
| Chore/Maintenance | `chore/` |

**Examples:**
- `feat/AA-123-add-user-auth`
- `fix/AA-456-login-redirect`
- `chore/AA-789-update-deps`

### 2.2 Create Branch

```bash
# Ensure we're on develop (or master for hotfixes)
git checkout develop
git pull origin develop

# Create feature branch
BRANCH_NAME="feat/$ARGUMENTS-short-description"  # Adjust type and description
git checkout -b "$BRANCH_NAME"

# Verify you're NOT on master/develop
git branch --show-current  # Should show your feature branch
```

**IMPORTANT**:
- Replace `short-description` with 2-4 words describing the work (lowercase, hyphenated)
- **NEVER work directly on `master` or `develop`** - always create a feature branch

---

## Phase 3: Start Work in Linear

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

## Phase 4: Analysis & Planning

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

## Phase 5: Implementation

Execute the work required by the issue.

**Guidelines:**
- Follow existing code patterns in the codebase
- Write tests if appropriate
- Keep changes focused on the issue scope
- Document complex logic with comments
- Commit incrementally for logical chunks of work

**For parallel work** (complex issues):
```
Use the Task tool to spawn multiple agents for independent subtasks.
Each agent should handle a specific, well-defined piece of work.
Maximum 10 parallel agents.
```

---

## Phase 6: Verification

Before committing, verify the implementation:

### 6.1 Check Related Issues

**If this is a subtask:**
```bash
cd .claude/skills/linear
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

### 6.2 Verify Acceptance Criteria

- [ ] All requirements from the description are met
- [ ] Code works as expected
- [ ] No regressions introduced
- [ ] Tests pass (if applicable)

### 6.3 Run Quality Checks

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Run tests
pnpm test:run
```

Fix any issues before proceeding.

---

## Phase 7: Changeset (Only for Published Packages)

**Changesets document changes that affect npm package users.** They are NOT needed for every PR.

### 7.1 Decision Matrix: Do I Need a Changeset?

| Changed Files | Changeset Needed? | Reason |
|---------------|-------------------|--------|
| `packages/bhono-app/src/*` | **YES** | CLI code published to npm |
| `packages/bhono-app/templates/*` | **YES** | Templates shipped to users |
| `packages/create-bhono/*` | **YES** | Published to npm |
| `src/*` (app code) | **NO** | Not published, internal app |
| `tests/*` | **NO** | Test-only changes |
| `config/*`, `.github/*` | **NO** | Build/CI infrastructure |
| `docs/*`, `*.md` | **NO** | Documentation only |
| `scripts/*` | **NO** | Internal tooling |

### 7.2 Quick Check

```bash
# Check if publishable package files were changed
git diff --name-only develop | grep -E "^packages/.*/src/|^packages/.*/templates/" && echo "CHANGESET NEEDED" || echo "NO CHANGESET NEEDED"
```

**Rule of thumb:** If users who `npm install @etus/bhono-app` won't notice the change, you don't need a changeset.

### 7.3 Determine Changeset Type (if needed)

| Change Type | Semver Bump | When to Use |
|-------------|-------------|-------------|
| `patch` | 0.0.X | Bug fixes, typos in templates, minor tweaks |
| `minor` | 0.X.0 | New features, new templates, new CLI options |
| `major` | X.0.0 | Breaking changes, removed features, API changes |

### 7.4 Create Changeset

```bash
pnpm changeset
```

Select the affected package(s), bump type, and write a **user-facing** summary:

**Good changeset message:**
```
fix: resolve template TypeScript errors on Windows

- Fix path separators in generated config files
- Add missing type declarations
```

**Bad changeset message:**
```
fixed stuff
```

### 7.5 Empty Changeset (Edge Case)

Only use `--empty` if:
- Package files changed but it's purely internal (refactoring, comments)
- CI requires a changeset but the change has no user impact

```bash
pnpm changeset --empty
```

### 7.6 No Changeset Needed

If your changes don't affect `packages/*/src` or `packages/*/templates`, simply skip this phase and proceed to commit.

---

## Phase 8: Commit Changes

### 8.1 Stage Changes

```bash
git add -A
```

### 8.2 Commit Message Format (Conventional Commits)

**Format:** `<type>(<scope>): <description>`

**Types:** (must match commitlint config)
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting, no code change
- `refactor` - Code change that neither fixes nor adds
- `perf` - Performance improvement
- `test` - Adding/updating tests
- `build` - Build system, dependencies
- `ci` - CI configuration
- `chore` - Other changes

**Scope:** Optional, typically:
- Package name: `(bhono-app)`
- Feature area: `(auth)`, `(api)`, `(ui)`
- Multiple: `(auth,api)`

**Description:**
- Present tense, imperative: "add" not "added" or "adds"
- Max 100 characters
- Reference issue at end: `closes AA-123` or `refs AA-123`

### 8.3 Create Commit

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <short description>

<optional body with details>

Closes $ARGUMENTS
EOF
)"
```

**Examples:**
```bash
# Feature
git commit -m "feat(auth): add OAuth 2.0 PKCE flow

Implement secure authentication with:
- PKCE challenge generation
- Token refresh mechanism
- Session management

Closes AA-123"

# Bug fix
git commit -m "fix(api): prevent null pointer in user lookup

Check for undefined user before accessing properties.

Closes AA-456"

# Chore
git commit -m "chore(deps): update dependencies

Closes AA-789"
```

---

## Phase 9: Push and Create PR

> **⚠️ NEVER push directly to `master` or `develop`!**
>
> All changes MUST go through a Pull Request. This ensures:
> - Code review before merge
> - CI checks run on the PR
> - Changeset validation for package releases
> - Audit trail of all changes

### 9.1 Push Feature Branch

```bash
# Push your feature branch (NOT master/develop)
git push -u origin HEAD
```

**Verify you're on a feature branch:**
```bash
git branch --show-current  # Should show feat/AA-123-xxx, NOT master/develop
```

### 9.2 Determine PR Target Branch

| Scenario | Target Branch | Example |
|----------|---------------|---------|
| Regular feature/fix | `develop` | New feature, bug fix, refactor |
| Hotfix for production | `master` | Critical bug in production |
| Release candidate | `master` | Merging develop → master |

### 9.3 Create Pull Request (REQUIRED)

```bash
gh pr create --base develop --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
## Summary

Brief description of changes.

**Linear Issue:** [$ARGUMENTS](https://linear.app/team/issue/$ARGUMENTS)

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] E2E tests pass

## Changeset

- [ ] Changeset created (if packages/ changed)
- [ ] No changeset needed (no package changes)

## Checklist

- [ ] Code follows project conventions
- [ ] Self-reviewed the diff
- [ ] Tests pass locally
- [ ] Documentation updated (if needed)
EOF
)"
```

### 9.4 Link PR to Linear Issue

Add a comment to the Linear issue with the PR link:

```bash
cd .claude/skills/linear
PR_URL=$(gh pr view --json url -q '.url')

npx tsx scripts/comments/create.ts $ARGUMENTS "$(cat <<EOF
## Pull Request Created

**PR:** $PR_URL

Awaiting code review.
EOF
)" --json
```

---

## Phase 10: Update Linear Status

### 10.1 Move to "In Review"

```bash
cd .claude/skills/linear

STATES=$(npx tsx scripts/status/list.ts --json)
IN_REVIEW=$(echo $STATES | jq -r '.statuses[] | select(.name == "In Review") | .id')

npx tsx scripts/status/update.ts $ARGUMENTS $IN_REVIEW --json
```

### 10.2 Add Completion Comment

```bash
npx tsx scripts/comments/create.ts $ARGUMENTS "$(cat <<'EOF'
## Implementation Summary

**Status**: 🔍 IN REVIEW

### Changes Made
- `path/to/file1.ts`: Brief description
- `path/to/file2.ts`: Brief description

### Features Implemented
- Feature 1: What it does
- Feature 2: What it does

### Testing
- [x] Unit tests added/updated
- [x] Manual testing completed
- [x] Lint and typecheck pass

### Changeset
- [x] Created (patch/minor/major) OR N/A

### PR
- Link: <PR_URL>
- Target: develop
EOF
)" --json
```

---

## Phase 11: Post-Merge (After PR Approved)

After the PR is merged:

### 11.1 Update Linear to "Done"

```bash
cd .claude/skills/linear

STATES=$(npx tsx scripts/status/list.ts --json)
DONE=$(echo $STATES | jq -r '.statuses[] | select(.name == "Done") | .id')

npx tsx scripts/status/update.ts $ARGUMENTS $DONE --json
```

### 11.2 Clean Up Local Branch

```bash
git checkout develop
git pull origin develop
git branch -d <branch-name>
```

### 11.3 Update Parent Issue (if subtask)

When completing the LAST subtask of a parent issue:

```bash
cd .claude/skills/linear

npx tsx scripts/comments/create.ts <PARENT-ID> "$(cat <<'EOF'
## All Subtasks Completed

**Status**: ✅ COMPLETED

### Completed Subtasks
- $ARGUMENTS: Brief summary
- <OTHER-ID>: Brief summary

### Summary
All acceptance criteria met. Feature ready for release.
EOF
)" --json

# Update parent status
npx tsx scripts/status/update.ts <PARENT-ID> $DONE --json
```

---

## Quick Reference

### Branch Commands
```bash
git checkout develop && git pull
git checkout -b feat/$ARGUMENTS-description
git push -u origin HEAD
```

### Commit Types
| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructure |
| `test` | Tests only |
| `docs` | Documentation |
| `chore` | Maintenance |

### Changeset Commands
```bash
pnpm changeset          # Interactive
pnpm changeset --empty  # Skip release
```

### Linear Status Commands
```bash
cd .claude/skills/linear
STATES=$(npx tsx scripts/status/list.ts --json)

IN_PROGRESS=$(echo $STATES | jq -r '.statuses[] | select(.name == "In Progress") | .id')
IN_REVIEW=$(echo $STATES | jq -r '.statuses[] | select(.name == "In Review") | .id')
DONE=$(echo $STATES | jq -r '.statuses[] | select(.name == "Done") | .id')
```

### PR Commands
```bash
gh pr create --base develop --title "..." --body "..."
gh pr view --json url -q '.url'
```

---

## Checklist

Before finishing this command, verify:

- [ ] Branch created with correct naming convention
- [ ] Issue status updated to "In Progress" at start
- [ ] All requirements implemented
- [ ] Quality checks pass (lint, typecheck, tests)
- [ ] Changeset created **only if** `packages/*/src` or `packages/*/templates` changed
- [ ] Commit message follows Conventional Commits
- [ ] PR created with proper description
- [ ] PR linked in Linear issue comment
- [ ] Issue status updated to "In Review"
- [ ] (Post-merge) Issue status updated to "Done"
- [ ] (Post-merge) Local branch cleaned up

**Remember**: An issue is NOT complete until:
1. PR is merged
2. Linear reflects "Done" status

**Changeset reminder**: Only needed for changes that affect npm package users (CLI code or templates).
