# Templates API Reference

This document covers how to work with Linear templates programmatically via the API.

## Creating Issues from Templates

### Using templateId

When creating an issue, you can specify a `templateId` to apply a template's defaults:

```bash
npx tsx scripts/issues/create.ts \
  --title "Bug: Login broken" \
  --templateId "template-uuid-here" \
  --json
```

**Note:** Values provided in the input **override** template defaults. So if you specify `--priority 1` but the template has priority 3, the issue will have priority 1.

### Using Default Template

To use the team's default template:

```graphql
mutation {
  issueCreate(input: {
    title: "New issue"
    teamId: "team-uuid"
    useDefaultTemplate: true
  }) {
    success
    issue { id identifier }
  }
}
```

## Querying Templates

### List All Templates

```graphql
query {
  templates {
    nodes {
      id
      name
      description
      type
      templateData
      team {
        id
        name
      }
      creator {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
}
```

### Get Team-Specific Templates

```graphql
query {
  team(id: "team-uuid") {
    templates {
      nodes {
        id
        name
        description
      }
    }
    defaultTemplateForMembers {
      id
      name
    }
    defaultTemplateForNonMembers {
      id
      name
    }
  }
}
```

### Get Single Template

```graphql
query {
  template(id: "template-uuid") {
    id
    name
    description
    type
    templateData
    team {
      id
      name
    }
  }
}
```

## Template Types

| Type | Description |
|------|-------------|
| `issue` | Standard issue template |
| `project` | Project template with milestones |

## Template Fields

The `templateData` field contains a JSON object with the template's default values:

```json
{
  "title": "Bug: ",
  "description": "## Summary\n\n## Steps to Reproduce\n\n## Expected Behavior\n\n## Actual Behavior",
  "priority": 2,
  "labelIds": ["label-uuid-1", "label-uuid-2"],
  "stateId": "state-uuid",
  "assigneeId": "user-uuid",
  "projectId": "project-uuid",
  "estimate": 3
}
```

## Creating Templates via API

### Create Issue Template

```graphql
mutation {
  templateCreate(input: {
    name: "Bug Report"
    type: issue
    teamId: "team-uuid"
    description: "Template for bug reports"
    templateData: {
      description: "## Summary\n\n## Steps to Reproduce\n\n"
      priority: 2
      labelIds: ["bug-label-uuid"]
    }
  }) {
    success
    template {
      id
      name
    }
  }
}
```

### Update Template

```graphql
mutation {
  templateUpdate(
    id: "template-uuid"
    input: {
      name: "Updated Bug Report"
      templateData: {
        priority: 1
      }
    }
  ) {
    success
    template {
      id
      name
    }
  }
}
```

### Delete Template

```graphql
mutation {
  templateDelete(id: "template-uuid") {
    success
  }
}
```

## Workflow: Get Template ID for Issue Creation

```bash
# 1. List templates to find the ID
TEMPLATES=$(npx tsx scripts/list-teams.ts --json)

# Or query directly via GraphQL
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ templates { nodes { id name team { key } } } }"
  }' | jq '.data.templates.nodes[] | select(.name == "Bug Report")'

# 2. Create issue using template ID
npx tsx scripts/issues/create.ts \
  --title "Bug: Specific issue" \
  --templateId "found-template-uuid" \
  --json
```

## Template + URL Creation (linear.new)

Create pre-filled issues via URL:

```
https://linear.app/workspace/team/KEY/new?template=template-uuid
https://linear.app/workspace/team/KEY/new?template=template-uuid&title=Override+Title
```

URL parameters **override** template values:
- `title` - Issue title
- `description` - Issue description
- `priority` - Priority (0-4)
- `labelIds` - Comma-separated label UUIDs
- `assigneeId` - Assignee UUID
- `projectId` - Project UUID

## Best Practices

1. **Template Inheritance**: Values you provide always override template defaults

2. **Team vs Workspace Templates**:
   - Team templates: Only available to that team
   - Workspace templates: Available to all teams (`teamId: null`)

3. **Default Templates**: Teams can set default templates for:
   - Members (internal issue creation)
   - Non-members (external/Asks issue creation)

4. **Template Versioning**: Templates don't version - changes apply immediately

5. **Finding Template IDs**:
   - Use GraphQL explorer: https://studio.apollographql.com/public/Linear-API
   - Query templates endpoint
   - Check URL when editing template in UI

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Template not found` | Invalid templateId | Query templates to get valid IDs |
| `Permission denied` | Template belongs to different team | Use team-specific template or workspace template |
| `Invalid template type` | Using project template for issue | Check template type field |

## Sources

- [Linear API Documentation](https://linear.app/developers/graphql)
- [Linear GraphQL Schema](https://studio.apollographql.com/public/Linear-API/schema/reference)
- [Create issues using linear.new](https://linear.app/developers/create-issues-using-linear-new)
