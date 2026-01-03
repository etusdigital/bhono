# Linear Issue Templates Guide

This guide covers best practices for creating and using issue templates in Linear, both via the UI and the API.

## Overview

Templates in Linear:
- Speed up issue creation with pre-filled fields
- Ensure consistent information capture across teams
- Enable filtering and reporting by template type
- Work across Linear UI, Slack, Asks, and API

## Template Types

### 1. Standard Templates

Pre-defined issue formats with:
- Title prefix/format
- Description (markdown with placeholder text)
- Default labels, priority, project, assignee
- Estimate and due date defaults

### 2. Form Templates (Business/Enterprise)

Structured forms with custom fields:
- Text inputs, dropdowns, checkboxes
- Required field validation
- Issue property fields (priority, customer, labels)
- Field descriptions and instructions

## Creating Templates

### Via Linear UI

1. Navigate to **Settings** → **Team** → **Templates**
2. Click **New Template**
3. Configure:
   - Template name
   - Description with placeholder text
   - Default properties (labels, priority, project)
4. Save template

### Via API

```bash
# Create issue from template
npx tsx scripts/issues/create.ts \
  --title "Bug: Login broken" \
  --templateId "template-uuid" \
  --json
```

The API's `IssueCreateInput` accepts:
- `templateId` - UUID of the template to use
- `useDefaultTemplate` - Boolean to use team's default template

**Note:** Values provided in the input override template defaults.

## Best Practices

### 1. Naming Conventions

Use clear, action-oriented titles:
```
✅ [Verb] [What] [Context]
   "Fix broken scroll in mobile navbar"
   "Add dark mode toggle to settings"

❌ Vague titles
   "Bug"
   "Feature"
```

### 2. Structured Descriptions

Include consistent sections:
```markdown
## Background
Why are we doing this? What's the context?

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Acceptance Criteria
What defines "done"?

## Links
- Design: [Figma link]
- Spec: [Doc link]
```

### 3. Use Placeholder Text

In Linear UI, format text as placeholder (select text → click **Aa** icon):
```markdown
## Steps to Reproduce
<Describe the steps you took>

## Expected Behavior
<What should have happened>

## Actual Behavior
<What actually happened>
```

### 4. Set Appropriate Defaults

Pre-fill fields that are always the same:
- Bug reports → "bug" label, Triage status
- Feature requests → "enhancement" label
- Technical debt → "tech-debt" label, Low priority

### 5. Keep Templates Minimal

Only include fields that are truly necessary. Too many required fields = friction.

## Template Examples

See the following files for ready-to-use templates:

| Template | File | Use Case |
|----------|------|----------|
| Bug Report | `bug-report.md` | User-reported bugs, QA findings |
| Feature Request | `feature-request.md` | New features, enhancements |
| Technical Debt | `tech-debt.md` | Refactoring, code cleanup |
| Security Issue | `security-issue.md` | Vulnerabilities, security fixes |
| Sprint Task | `sprint-task.md` | General sprint work items |

## Filtering by Template

Issues created from templates are filterable:
```
template:Bug Report
template:Feature Request
```

Use Insights to analyze:
- Bug reports vs feature requests ratio
- Resolution time by template type
- Template usage by team

## Integration with Slack/Asks

Templates can be used in:
- **Slack**: Up to 5 templates available via `/linear` command
- **Asks**: Form templates for external stakeholders
- **Email**: Create issues from templates via intake email

## API Reference

### Query Templates

```graphql
query {
  templates {
    nodes {
      id
      name
      description
      type
      team { id name }
    }
  }
}
```

### Create Issue from Template

```graphql
mutation {
  issueCreate(input: {
    title: "Issue title"
    teamId: "team-uuid"
    templateId: "template-uuid"
  }) {
    success
    issue { id identifier url }
  }
}
```

### Using Default Template

```graphql
mutation {
  issueCreate(input: {
    title: "Issue title"
    teamId: "team-uuid"
    useDefaultTemplate: true
  }) {
    success
    issue { id identifier url }
  }
}
```

## Sources

- [Linear Issue Templates Documentation](https://linear.app/docs/issue-templates)
- [Linear Project Templates](https://linear.app/docs/project-templates)
- [Linear Form Templates (Nov 2025)](https://linear.app/changelog/2025-11-20-form-templates)
- [Linear API Documentation](https://linear.app/developers/graphql)
