# Feature Request Template

## Template Configuration

| Property | Value |
|----------|-------|
| **Name** | Feature Request |
| **Labels** | `enhancement` |
| **Priority** | 3 (Medium) or use triage |
| **Default Status** | Backlog |

## Description Template

```markdown
## Problem Statement
<!-- What problem does this solve? Who is affected? -->

## Proposed Solution
<!-- Describe the feature you'd like -->

## User Stories
<!-- As a [user type], I want [feature] so that [benefit] -->

- As a user, I want to...
- As an admin, I want to...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Design/Mockups
<!-- Link to designs or describe UI expectations -->

## Technical Considerations
<!-- Any known technical constraints or dependencies -->

## Alternatives Considered
<!-- What other solutions were explored? -->

## Additional Context
<!-- Business value, customer requests, competitive analysis -->
```

## CLI Usage

```bash
# Create feature request
npx tsx scripts/issues/create.ts \
  --title "Feature: Add dark mode toggle" \
  --description "## Problem Statement
Users have requested dark mode support, especially for nighttime usage. Currently, the app only supports light theme which causes eye strain in low-light environments.

## Proposed Solution
Add a dark mode toggle in Settings that switches the app theme. The preference should persist across sessions.

## User Stories
- As a user, I want to switch to dark mode so that I can use the app comfortably at night
- As a user, I want my theme preference saved so that I don't have to toggle it each session

## Acceptance Criteria
- [ ] Toggle switch in Settings page
- [ ] Dark theme applied to all components
- [ ] Preference persisted in localStorage
- [ ] Respects system preference by default
- [ ] Smooth transition animation

## Design/Mockups
https://www.figma.com/file/abc123

## Technical Considerations
- Use CSS variables for theme colors
- Consider prefers-color-scheme media query
- Test with all existing components

## Alternatives Considered
- Auto-detect only (no manual toggle) - rejected: users want control
- Scheduled dark mode - future enhancement" \
  --priority 3 \
  --json
```

## Best Practices

1. **Title Format**: `Feature: Brief description`
   - `Feature: Add export to CSV functionality`
   - `Feature: Enable two-factor authentication`

2. **Focus on the Problem**: Explain the "why" before the "what"

3. **Include User Stories**: Helps team understand user perspective

4. **Define Done**: Clear acceptance criteria prevent scope creep

5. **Link Designs**: Visual references accelerate development

6. **Mention Alternatives**: Shows you've thought through options

## Priority Guidelines

| Priority | Criteria |
|----------|----------|
| **Urgent (1)** | Critical for launch, blocking revenue |
| **High (2)** | High customer demand, competitive feature |
| **Medium (3)** | Nice to have, improves UX |
| **Low (4)** | Future consideration, minor enhancement |

## Linking Related Issues

Reference related issues in the description:
```markdown
## Related Issues
- Blocked by: https://linear.app/workspace/issue/AA-100
- Related: https://linear.app/workspace/issue/AA-101
- Parent epic: https://linear.app/workspace/issue/AA-50
```

Linear will automatically convert these URLs to clickable issue links.
