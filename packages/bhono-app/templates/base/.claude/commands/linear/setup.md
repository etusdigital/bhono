---
description: Initialize Linear configuration for this project - setup credentials, default team, project, and preferences
---

# Linear Setup for Project

Execute the following setup workflow step by step:

## Step 1: Verify Credentials

Check if Linear credentials are configured:
- Try to execute: `cd .claude/skills/linear && npx tsx scripts/list-teams.ts --json`
- If it fails with "LINEAR_API_KEY not found":
  - Tell user: "Linear API key not found. Running credential setup..."
  - Execute: `cd .claude/skills/linear && npx tsx scripts/setup/setup-credentials.ts`
  - Wait for completion before proceeding

## Step 2: Get Current User

Use the linear skill to get current user information:
- Execute: `cd .claude/skills/linear && npx tsx scripts/users/me.ts --json`
- Extract and display: user name and email
- Save user ID for later use

## Step 3: List Available Teams

Use the linear skill to list all teams:
- Execute: `cd .claude/skills/linear && npx tsx scripts/list-teams.ts --json`
- Display teams in a clear format showing: name, key, and ID
- Ask user: "Which team should be the default for this project?"
- Use AskUserQuestion tool to let user select from the list
- Save selected team ID and name

## Step 4: List Projects for Selected Team

Use the linear skill to list projects for the selected team:
- Filter projects from step 3 that match the selected team ID
- Display projects showing: name and ID
- Ask user: "Which project should issues be associated with by default?"
- Options: List all projects + "None (no default project)"
- Use AskUserQuestion tool to let user select
- Save selected project ID (or null if "None")

## Step 5: Auto-Assignment Preference

Ask user about auto-assignment:
- Use AskUserQuestion tool with options:
  - "Yes - Always assign new issues to me"
  - "No - Leave issues unassigned by default"
- Save preference (true/false)

## Step 6: Configuration Sharing Preference

Explain to the user:
```
📋 Configuration Storage

Your Linear preferences will be saved to: .claude/linear-config.json

This file contains:
- Default team and project for this repository
- Your auto-assignment preference
- Your user information

You have two options:
```

Use AskUserQuestion tool:
- Question: "How should this configuration be handled?"
- Header: "Config Sharing"
- Options:
  - "Commit to git - Share defaults with team (recommended for team projects)"
  - "Keep local only - Add to .gitignore (recommended for personal projects)"

**If "Commit to git"**:
- Configuration will be committed and shared with team
- Everyone cloning the repo will use these defaults
- Note: User information is personal but safe to share

**If "Keep local only"**:
- Add `.claude/linear-config.json` to `.gitignore` if not already there
- Each team member will need to run setup
- More flexible for teams using different teams/projects

Save the user's choice for the next step.

## Step 7: Save Configuration

Create configuration file at `.claude/linear-config.json` with structure:
```json
{
  "user": {
    "id": "<user-id>",
    "name": "<user-name>",
    "email": "<user-email>"
  },
  "defaults": {
    "teamId": "<selected-team-id>",
    "teamName": "<selected-team-name>",
    "teamKey": "<selected-team-key>",
    "projectId": "<selected-project-id-or-null>",
    "projectName": "<selected-project-name-or-null>",
    "autoAssign": true/false
  },
  "setupDate": "<current-date-iso>"
}
```

Use the Write tool to create this file with proper JSON formatting.

**If user chose "Keep local only"**:
- Check if `.gitignore` exists in project root
- If `.gitignore` exists:
  - Check if `.claude/linear-config.json` is already ignored
  - If not, append: `.claude/linear-config.json` to `.gitignore`
  - Confirm: "Added .claude/linear-config.json to .gitignore"
- If `.gitignore` doesn't exist:
  - Tell user: "⚠️  No .gitignore found. Remember to add .claude/linear-config.json manually if you don't want to commit it."

**If user chose "Commit to git"**:
- Do nothing extra
- Configuration will be available for git commit

## Step 8: Confirmation

Display success message with configuration details and sharing status:

**If user chose "Commit to git"**:
```
✅ Linear configuration completed!

📋 Configuration Details:
Default Team: <team-name> (<team-key>)
Default Project: <project-name or "None">
Auto-assign: <Yes/No>
User: <user-name> (<user-email>)

📁 Configuration saved to: .claude/linear-config.json
🔄 Sharing: Will be committed to git (shared with team)

Next steps:
• Commit this file to share defaults with your team
• Use /linear:create-issue to create issues
• Run /linear:setup again to reconfigure
```

**If user chose "Keep local only"**:
```
✅ Linear configuration completed!

📋 Configuration Details:
Default Team: <team-name> (<team-key>)
Default Project: <project-name or "None">
Auto-assign: <Yes/No>
User: <user-name> (<user-email>)

📁 Configuration saved to: .claude/linear-config.json
🔒 Privacy: Local only (added to .gitignore)

Next steps:
• Your preferences are personal and won't be committed
• Team members will need to run /linear:setup
• Use /linear:create-issue to create issues
• Run /linear:setup again to reconfigure
```

## Error Handling

- If any step fails, display clear error message
- If credentials setup fails, provide instructions to manually configure ~/.linear/credentials
- If user cancels during questions, save partial config and explain what's missing
- Always verify each Linear API call succeeded before proceeding

## Important Notes

- Execute each step sequentially, waiting for completion
- Use AskUserQuestion for all user choices (don't guess)
- Validate all IDs exist before saving to config
- Create .claude directory if it doesn't exist
- Make config file readable with proper formatting
