---
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task, TodoWrite, SlashCommand
argument-hint: [--no-tests] [--no-lint] [--no-docs] [--no-claude-md] [--no-readme] [--no-push] [--pr]
description: Automated commit/push workflow with quality checks, documentation updates, and PR creation
skills: playwright-e2e-testing
---

# /ship - Automated Commit Workflow

Fully automated workflow that runs quality checks, updates documentation, and commits/pushes changes.

## Arguments Received

```
$ARGUMENTS
```

## Parse Flags

!`echo "$ARGUMENTS" | grep -q "\-\-no-tests" && echo "SKIP_TESTS=true" || echo "SKIP_TESTS=false"`
!`echo "$ARGUMENTS" | grep -q "\-\-no-lint" && echo "SKIP_LINT=true" || echo "SKIP_LINT=false"`
!`echo "$ARGUMENTS" | grep -q "\-\-no-docs" && echo "SKIP_DOCS=true" || echo "SKIP_DOCS=false"`
!`echo "$ARGUMENTS" | grep -q "\-\-no-claude-md" && echo "SKIP_CLAUDE_MD=true" || echo "SKIP_CLAUDE_MD=false"`
!`echo "$ARGUMENTS" | grep -q "\-\-no-readme" && echo "SKIP_README=true" || echo "SKIP_README=false"`
!`echo "$ARGUMENTS" | grep -q "\-\-no-push" && echo "SKIP_PUSH=true" || echo "SKIP_PUSH=false"`
!`echo "$ARGUMENTS" | grep -q "\-\-pr" && echo "CREATE_PR=true" || echo "CREATE_PR=false"`

## Current Branch

!`git branch --show-current`

## Current Git Status

!`git status --short`

## Changed Files (Staged + Unstaged)

!`git diff --name-only HEAD 2>/dev/null || git diff --name-only`

## Recent Commits (for commit message style)

!`git log --oneline -5`

---

## INSTRUCTIONS

Execute this workflow in order. Use TodoWrite to track progress through each phase.

### Phase 0: Branch Validation (CRITICAL)

**Check if on a protected branch:**

```bash
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "master" || "$CURRENT_BRANCH" == "develop" ]]; then
  echo "❌ ABORT: Cannot ship directly from '$CURRENT_BRANCH'"
  echo "Create a feature branch first: git checkout -b feat/your-feature"
  exit 1
fi
echo "✅ On branch: $CURRENT_BRANCH"
```

**Branch rules:**
- ❌ `master` - NEVER commit directly (protected, releases only)
- ❌ `develop` - NEVER commit directly (PRs only)
- ✅ `feat/*`, `fix/*`, `docs/*`, `chore/*`, `refactor/*`, `test/*` - OK
- ✅ `hotfix/*` - OK (can PR to master for emergencies)

If on protected branch, **STOP and ask user to create a feature branch**.

### Phase 1: Information Gathering (Parallel Subagents)

Launch 3 subagents IN PARALLEL using the Task tool:

**Agent 1 - Change Analyzer:**

```
Analyze the git diff to understand what changed.
Run: git diff --stat && git diff --name-only
Categorize changes by:
- Source code changes (apps/, packages/)
- Test changes (tests/)
- Config changes (*.json, *.yaml, etc.)
- Documentation changes (docs/, *.md)
Return a structured summary of what changed and the primary type of change (feat/fix/refactor/test/docs/chore).
```

**Agent 2 - CLAUDE.md and AGENTS.md Mapper:**

```
Run /prime first to understand the codebase.
Given the changed files, identify which CLAUDE.md and AGENTS.md files need updating.
Map changed source files to their nearest CLAUDE.md:
- apps/edge/src/* → apps/edge/src/CLAUDE.md and apps/edge/src/AGENTS.md
- packages/sdk-web/src/* → packages/sdk-web/src/CLAUDE.md and packages/sdk-web/src/AGENTS.md
- etc.
Also check if root CLAUDE.md and AGENTS.md needs updating (new packages, commands, key files).
Return list of CLAUDE.md and AGENTS.md files that need updates.
```

**Agent 3 - Architecture Docs Mapper:**

```
Run /prime first to understand the codebase.
Given the changed files, identify which architecture docs need updating:
- Update the README.md if structural changes
- Update the `docs/app_spec.txt` if structural changes
- API endpoint changes → docs/architecture/api-catalog.md
- New components/services → docs/architecture/c4-component.md
- Container changes → docs/architecture/c4-container.md
- Dependency changes → docs/architecture/dependencies.md
- Tech debt changes → docs/architecture/tech-debt.md
- ERD/database changes → docs/architecture/erd.md
- Features updates → docs/features/
- Testing changes → docs/testing.md
Return list of architecture docs that need updates with reason.
```

Wait for all 3 agents to complete before proceeding.

### Phase 2: Quality Checks (Sequential)

**Skip this phase if --no-tests AND --no-lint are both set.**

Execute sequentially (not parallel) to avoid file conflicts when fixing:

#### Step 2.1: Tests (unless --no-tests)

```bash
pnpm run test
```

- If tests fail: Fix the failing tests, then rerun
- Repeat until all tests pass
- Maximum 3 fix attempts, then report and continue

#### Step 2.2: Lint (unless --no-lint)

```bash
pnpm run lint
```

- If lint fails: Run `pnpm run lint --fix` first
- For remaining errors: Fix manually, then rerun
- Maximum 3 fix attempts, then report and continue

#### Step 2.3: Typecheck (unless --no-lint)

```bash
pnpm run typecheck
```

- If typecheck fails: Fix type errors, then rerun
- Maximum 3 fix attempts, then report and continue

### Phase 3: Documentation Updates (Parallel Subagents)

**Launch documentation update subagents IN PARALLEL based on Phase 1 results.**

Only launch agents for docs that need updating (from Phase 1 analysis).

**Agent A - README (unless --no-readme):**

```
Run /prime first.
Review the changes and determine if README.md needs updating.
Update if: new packages added, commands changed, architecture shifted, project structure modified.
Make minimal, focused updates only for what changed.
```

**Agent B - Root CLAUDE.md and AGENTS.md (unless --no-claude-md):**

```
Run /prime first.
Run /claude-md optimize to update the root CLAUDE.md and /agents-md optimize to update the root AGENTS.md.
Focus on reflecting any new apps, packages, key files, or command changes.
```

**Agent C - Package CLAUDE.md and AGENTS.md files (unless --no-claude-md):**

```
Run /prime first.
For each affected CLAUDE.md and AGENTS.md identified in Phase 1:
- Navigate to that directory
- Run /claude-md optimize
- Run /agents-md optimize
Only update CLAUDE.md and AGENTS.md files in directories where source code actually changed.
```

**Agent D - Architecture Docs (unless --no-docs):**

```
Run /prime first.
For each architecture doc identified in Phase 1:
- Read the current doc
- Update only sections affected by the changes
- Maintain existing structure and style

Docs to potentially update:
- docs/architecture/api-catalog.md - API endpoint changes
- docs/architecture/c4-component.md - Component changes
- docs/architecture/c4-container.md - Container/service changes
- docs/architecture/c4-context.md - System context changes
- docs/architecture/dependencies.md - Dependency changes
- docs/architecture/tech-debt.md - Tech debt updates
- docs/architecture/erd.md - Database schema changes
- docs/features/ - Feature changes
- docs/testing.md - Testing strategy changes
- docs/app_spec.txt - Major architectural changes
```

Wait for all documentation agents to complete.

### Phase 4: Commit & Push (Sequential)

#### Step 4.1: Stage All Changes

```bash
git add -A
```

#### Step 4.2: Generate Commit Message

Based on Phase 1 analysis, generate a conventional commit message:

**Type detection:**

- New files in src/, packages/, apps/ → `feat`
- Modified existing source files → `fix` or `refactor`
- Only test files → `test`
- Only docs → `docs`
- Config files, dependencies → `chore`

**Scope detection:**

- Single package changed → `(package-name)`
- Multiple packages → `(pkg1,pkg2)` or omit
- Docs only → `(docs)`

**Format:**

```
<type>(<scope>): <summary>

<body with bullet points of main changes>
```

#### Step 4.3: Commit

```bash
git commit -m "$(cat <<'EOF'
<generated commit message>
EOF
)"
```

#### Step 4.4: Push (unless --no-push)

```bash
git push -u origin $(git branch --show-current)
```

**Note:** The project has Husky pre-push hooks that automatically run:
- TypeScript compilation (`pnpm typecheck`)
- Unit tests with coverage (`pnpm test:unit:server`)
- Build verification (`pnpm build`)

If any of these fail, the push will be rejected.

### Phase 5: Pull Request (if --pr flag is set)

**Create PR targeting `develop` branch:**

```bash
gh pr create --base develop --title "<commit message title>" --body "$(cat <<'EOF'
## Summary
<bullet points from commit body>

## Test plan
- [x] TypeScript compiles
- [x] Unit tests pass
- [x] Build succeeds
EOF
)"
```

**PR Rules:**
- PRs MUST target `develop` (enforced by CI workflow `.github/workflows/pr-target-check.yml`)
- Only `changeset-release/*` and `hotfix/*` branches can PR directly to `master`
- If PR already exists for this branch, show the existing PR URL instead

**Check for existing PR:**
```bash
gh pr view --json url 2>/dev/null || gh pr create ...
```

---

## Completion Report

After all phases complete, provide a summary:

```
## /ship Complete

### Branch
- Branch: <branch name>
- Base: develop

### Quality Checks
- Tests: [PASSED/FIXED/SKIPPED]
- Lint: [PASSED/FIXED/SKIPPED]
- Typecheck: [PASSED/FIXED/SKIPPED]

### Documentation Updated
- README.md: [YES/NO/SKIPPED]
- CLAUDE.md files: [list or SKIPPED]
- AGENTS.md: [YES/NO/SKIPPED]
- Architecture docs: [list or SKIPPED]

### Git
- Commit: <commit hash>
- Pushed: [YES/NO]
- PR: [URL or SKIPPED or N/A]
```
