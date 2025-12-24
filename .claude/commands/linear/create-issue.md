---
description: Create a new Linear issue with interactive prompts for missing information
argument-hint: [title] [description] [priority]
---

# Create Linear Issue

Execute the following workflow to create a Linear issue:

## Step 1: Verify Configuration

Check if Linear is configured for this project:
- Use Read tool to check if `.claude/linear-config.json` exists
- If file does NOT exist:
  - Tell user: "⚠️  Linear is not configured for this project. Running setup first..."
  - Execute: Use SlashCommand tool to run `/linear:setup`
  - Wait for setup to complete successfully
  - Continue to Step 2 after setup completes

- If file EXISTS:
  - Read and parse the JSON configuration
  - Extract: teamId, teamName, projectId, projectName, autoAssign, user.id
  - Validate all required fields are present
  - If invalid config, run `/linear:setup` again

## Step 2: Parse Arguments

Check what information was provided in `$ARGUMENTS`:

**If $ARGUMENTS is empty or only whitespace:**
- All information needs to be collected via questions
- Set: `needTitle = true`, `needDescription = true`, `needPriority = true`

**If $ARGUMENTS contains text:**
- Try to intelligently parse the arguments
- Check if it looks like: "title" or "title | description" or "title | description | priority"
- Extract what's available
- Set flags for what's still needed

## Step 3: Collect Missing Information

For each missing piece of information, ask the user:

### Ask for Title (if needed)
Use AskUserQuestion tool:
- Question: "What is the issue title?"
- Header: "Issue Title"
- Options: Free text input (user will use "Other" field)
- Validate: Title must not be empty

### Ask for Description (if needed)
Use AskUserQuestion tool:
- Question: "Do you want to add a description for this issue?"
- Header: "Description"
- Options:
  - "Yes - I'll provide a description" → Then ask for description text
  - "No - Create without description"
- If Yes: Ask for description text via another question

### Ask for Priority (if needed)
Use AskUserQuestion tool:
- Question: "What priority should this issue have?"
- Header: "Priority"
- Options:
  - "None (0) - No specific priority"
  - "Urgent (1) - Critical issue requiring immediate attention"
  - "High (2) - Important issue to address soon"
  - "Medium (3) - Normal priority" (default suggestion)
  - "Low (4) - Nice to have, can wait"
- Extract numeric value (0-4) from selection

### Ask for Project Association (optional)
If config has projectId set:
- Use that project by default
- Ask: "Use default project '<projectName>'?"
  - "Yes - Use default project"
  - "No - Create without project association"

If config has no default project:
- Ask: "Do you want to associate this issue with a project?"
  - "No - Create without project" (default)
  - "Yes - Let me choose a project" → Then list available projects

## Step 4: Confirm Issue Details

Display summary before creating:
```
📝 Ready to create Linear issue:

Title: <title>
Description: <description or "None">
Priority: <priority-label> (<priority-number>)
Team: <teamName> (<teamKey>)
Project: <projectName or "None">
Assignee: <user-name if autoAssign, else "Unassigned">

Proceed with creation?
```

Use AskUserQuestion:
- "Yes - Create issue"
- "No - Cancel"

If No: Exit and tell user "Issue creation cancelled"

## Step 5: Create Issue

Execute issue creation using the linear skill:

**Basic creation command:**
```bash
cd .claude/skills/linear && npx tsx scripts/issues/create.ts "<title>" <teamId> "<description>" --json
```

**Parse the response to get:**
- Issue ID (UUID)
- Issue identifier (e.g., "AA-123")
- Issue URL

## Step 6: Set Priority (if not None)

If priority is 1-4 (not 0):
```bash
cd .claude/skills/linear && npx tsx scripts/issues/update.ts <issueId> --priority <priority-number> --json
```

## Step 7: Assign to User (if autoAssign is true)

If config.autoAssign is true:
```bash
cd .claude/skills/linear && npx tsx scripts/issues/update.ts <issueId> --assignee <userId> --json
```

Note: This may require adding assignee support to update.ts script if not present.
For now, mention in output that auto-assignment will be implemented.

## Step 8: Associate with Project (if selected)

If project was selected and not null:
```bash
cd .claude/skills/linear && npx tsx scripts/issues/update.ts <issueId> --project <projectId> --json
```

Note: This may require adding project support to update.ts script.
For now, skip this step and note it in the output.

## Step 9: Success Message

Display formatted success message:
```
✅ Issue created successfully!

Identifier: <identifier> (e.g., AA-123)
Title: <title>
Status: <status>
Priority: <priority-label>
URL: <url>

View in Linear: <url>
```

## Error Handling

- If configuration file is missing → Run setup first
- If configuration is invalid → Run setup again
- If user cancels any question → Exit gracefully with message
- If Linear API call fails → Display error and suggest checking credentials
- If title is empty after questions → Require valid title
- If team ID is invalid → Run setup again

## Tips for User

After successful creation, suggest:
```
💡 Tips:
- Use /linear:create-issue <title> for quick creation with defaults
- Use /linear:create-issue <title> | <description> | <priority> for full details
- Run /linear:setup to change default team/project
```

## Important Notes

- **Always verify config exists before creating issues**
- **Use AskUserQuestion for ALL user input** - never guess or assume
- **Execute Linear commands sequentially** - wait for each to complete
- **Validate all responses** before proceeding to next step
- **Parse JSON responses carefully** to extract correct IDs
- **Handle empty descriptions** gracefully (pass empty string or omit)
- **Priority must be 0-4** - validate user input
- **Show clear progress** - tell user what's happening at each step
