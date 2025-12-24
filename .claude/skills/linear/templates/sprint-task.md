# Sprint Task Template

## Template Configuration

| Property | Value |
|----------|-------|
| **Name** | Sprint Task |
| **Labels** | (varies by task type) |
| **Priority** | 3 (Medium) |
| **Default Status** | Todo |
| **Estimate** | (set per task) |

## Description Template

```markdown
## Objective
<!-- What needs to be accomplished? -->

## Background
<!-- Why are we doing this? Context and motivation -->

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## Technical Approach
<!-- How will this be implemented? -->

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests written and passing
- [ ] Code reviewed

## Dependencies
<!-- What needs to happen first? -->

## Out of Scope
<!-- What are we NOT doing? -->

## Links
- Design:
- Spec:
- Parent issue:
```

## CLI Usage

```bash
# Create sprint task
npx tsx scripts/issues/create.ts \
  --title "Implement user avatar upload" \
  --description "## Objective
Add the ability for users to upload and update their profile avatar.

## Background
Users have requested the ability to personalize their profiles. Currently, we only show initials.

## Requirements
- [ ] Upload button on profile settings page
- [ ] Support JPEG, PNG, WebP formats
- [ ] Max file size: 5MB
- [ ] Auto-resize to 256x256
- [ ] Store in S3 bucket

## Technical Approach
1. Add file input component to ProfileSettings
2. Create \`/api/users/avatar\` endpoint
3. Use sharp for image processing
4. Upload to S3 with user ID as key
5. Update user record with avatar URL

## Acceptance Criteria
- [ ] User can upload image from profile settings
- [ ] Image is resized and optimized
- [ ] Avatar displays throughout app
- [ ] Invalid files show error message
- [ ] Unit tests for upload service
- [ ] E2E test for upload flow

## Dependencies
- S3 bucket configured (already done)
- sharp package installed

## Out of Scope
- Avatar cropping UI (future enhancement)
- Gravatar integration
- Avatar history

## Links
- Design: https://www.figma.com/file/abc123
- Parent epic: https://linear.app/workspace/issue/AA-50" \
  --priority 3 \
  --estimate 3 \
  --json
```

## Best Practices

1. **Title Format**: Imperative verb + what
   - `Implement user avatar upload`
   - `Add pagination to user list`
   - `Fix memory leak in WebSocket handler`

2. **Define "Done"**: Clear acceptance criteria prevent ambiguity

3. **List Dependencies**: Helps with sprint planning

4. **Scope Boundaries**: "Out of Scope" prevents creep

5. **Link Related Issues**: Reference parent epics, blockers, related work

## Estimate Guidelines

Use Fibonacci or T-shirt sizing consistently:

| Points | Effort | Example |
|--------|--------|---------|
| 1 | Few hours | Config change, copy update |
| 2 | Half day | Simple component, small fix |
| 3 | 1 day | Feature with tests |
| 5 | 2-3 days | Complex feature |
| 8 | 1 week | Large feature, multiple components |
| 13 | 2 weeks | Epic-level work (should be broken down) |

## Task Breakdown Pattern

For larger tasks, create sub-issues:

```bash
# Parent task
npx tsx scripts/issues/create.ts \
  --title "Epic: User profile system" \
  --description "..." \
  --json

# Sub-tasks (using parent ID)
npx tsx scripts/issues/create.ts \
  --title "Add profile settings page" \
  --parent AA-100 \
  --estimate 3 \
  --json

npx tsx scripts/issues/create.ts \
  --title "Implement avatar upload" \
  --parent AA-100 \
  --estimate 5 \
  --json

npx tsx scripts/issues/create.ts \
  --title "Add profile API endpoints" \
  --parent AA-100 \
  --estimate 3 \
  --json
```

## Status Workflow

Typical sprint task flow:
```
Todo → In Progress → In Review → Done
```

Update status as you work:
```bash
# Start working
npx tsx scripts/status/update.ts AA-101 "in-progress-state-id" --json

# Submit for review
npx tsx scripts/status/update.ts AA-101 "in-review-state-id" --json

# Complete
npx tsx scripts/status/update.ts AA-101 "done-state-id" --json
```
