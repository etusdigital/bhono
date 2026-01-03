# Linear Slash Commands

Custom slash commands for streamlined Linear issue management in Claude Code.

## Available Commands

### 1. `/linear:setup`

**Purpose**: Initialize Linear configuration for the project

**What it does**:
- Verifies/configures Linear API credentials
- Gets current user information
- Sets default team for the project
- Sets default project (optional)
- Configures auto-assignment preference
- Saves configuration to `.claude/linear-config.json`

**Usage**:
```
/linear:setup
```

**When to use**:
- First time using Linear in this project
- When you want to change default team or project
- After cloning a repository (if config not committed)

**Interactive flow**:
1. Checks for Linear credentials (runs credential setup if needed)
2. Displays your Linear user information
3. Lists all available teams → asks you to select default
4. Lists projects for selected team → asks which one to use
5. Asks about auto-assignment preference
6. **Asks how to handle configuration** → commit to git or keep local
7. Saves configuration (and updates .gitignore if keeping local)
8. Confirms with details about where config was saved and sharing status

**Output**: Configuration file at `.claude/linear-config.json`

---

### 2. `/linear:create-issue`

**Purpose**: Create a new Linear issue with interactive prompts

**What it does**:
- Verifies Linear is configured (runs setup if not)
- Collects missing information via questions
- Creates issue with provided/collected data
- Sets priority, assignee based on configuration
- Returns issue identifier and URL

**Usage**:

**Quick creation (title only)**:
```
/linear:create-issue Fix login button not responding
```

**With description**:
```
/linear:create-issue Fix login button | Users report the login button does not respond on mobile devices
```

**Full details**:
```
/linear:create-issue Fix login button | Button unresponsive on mobile | urgent
```

**No arguments (fully interactive)**:
```
/linear:create-issue
```

**When to use**:
- Creating any new Linear issue
- Quick bug reports
- Feature requests
- Tasks that need tracking

**Interactive flow** (when info is missing):
1. Verifies `.claude/linear-config.json` exists
2. If not configured → runs `/linear:setup` first
3. Asks for title (if not provided)
4. Asks if you want to add description
5. Asks for priority level (0-4)
6. Confirms details before creating
7. Creates issue with all collected information
8. Sets priority (if not None)
9. Assigns to you (if autoAssign is true)
10. Returns issue identifier and URL

**Output**: Issue details with URL for easy access

---

## Configuration File

The setup command creates `.claude/linear-config.json` with structure:

```json
{
  "user": {
    "id": "user-uuid",
    "name": "Your Name",
    "email": "you@example.com"
  },
  "defaults": {
    "teamId": "team-uuid",
    "teamName": "Team Name",
    "teamKey": "KEY",
    "projectId": "project-uuid-or-null",
    "projectName": "Project Name or null",
    "autoAssign": true
  },
  "setupDate": "2025-01-13T12:00:00.000Z"
}
```

### Configuration Sharing

**The setup command asks you** how to handle the configuration file:

**Option 1: "Commit to git"** (Recommended for team projects)
- ✅ Everyone uses same team/project defaults
- ✅ No setup needed after cloning
- ✅ Consistent workflow across team
- ⚠️ Team members inherit your preferences
- 📋 User information is included but safe to share

**Option 2: "Keep local only"** (Recommended for personal projects)
- ✅ Each developer configures their own preferences
- ✅ More flexible for individual workflows
- ✅ **Automatically adds to .gitignore**
- ⚠️ Requires running setup after clone
- 🔒 Your preferences stay private

**What the setup does**:
- If you choose "Commit to git" → Creates config file only
- If you choose "Keep local only" → Creates config + updates .gitignore

**You can change this later**:
- To switch from local to shared: Remove from .gitignore and commit
- To switch from shared to local: Add to .gitignore and git rm --cached
- Or just run `/linear:setup` again

---

## Examples

### First-time setup workflow

```
User: "Set up Linear for this project"
Claude: [Runs /linear:setup]
        → Verifies credentials
        → Shows teams: "PDB", "Marketing", "AA Lab"
        → You select: "AA Lab"
        → Shows projects: "Todo AA", "GAM-API", "OAuth Gateway"
        → You select: "OAuth Gateway"
        → Asks: Auto-assign? → You select: "Yes"
        → Asks: How to handle config? → You select: "Commit to git"
        → Saves config to .claude/linear-config.json
        → Confirms: "✅ Linear configured for AA Lab / OAuth Gateway"
        → Notes: "Configuration will be committed to git (shared with team)"
```

### Quick bug creation

```
User: "Create issue: Login button broken on mobile"
Claude: [Runs /linear:create-issue Login button broken on mobile]
        → Loads config (AA Lab team, OAuth Gateway project, auto-assign)
        → Asks: "Add description?" → You select: "Yes"
        → Asks for description → You provide details
        → Asks: "Priority?" → You select: "High (2)"
        → Confirms details
        → Creates issue AA-1234
        → Sets priority to High
        → Assigns to you
        → Returns: "✅ Issue AA-1234 created: https://linear.app/..."
```

### Fully interactive creation

```
User: "/linear:create-issue"
Claude: [Runs command without arguments]
        → Loads config
        → Asks: "What is the issue title?"
        → You: "Add dark mode toggle"
        → Asks: "Add description?"
        → You: "Yes"
        → Asks for description
        → You: "Users want dark mode option in settings"
        → Asks: "Priority?"
        → You select: "Medium (3)"
        → Confirms details
        → Creates issue
        → Returns: "✅ Issue AA-1235 created"
```

---

## Troubleshooting

### "Linear is not configured"
- **Solution**: Run `/linear:setup`
- The create-issue command will automatically run setup if needed

### "LINEAR_API_KEY not found"
- **Solution**: Setup command will run credential configuration
- Follow prompts to enter your Linear API key
- Key is saved to `~/.linear/credentials`

### "Configuration file is invalid"
- **Solution**: Run `/linear:setup` again
- This will recreate the config with correct format

### "Team ID not found"
- **Solution**: Run setup again to select a valid team
- Teams may have been deleted or access revoked

### Want to change defaults?
- **Solution**: Run `/linear:setup` anytime
- It will reconfigure all settings

---

## Tips

1. **Use natural language**: You can say "create a bug issue about login" and Claude will invoke the command

2. **Quick creation syntax**:
   - Just title: `/linear:create-issue <title>`
   - With description: `/linear:create-issue <title> | <description>`
   - Full: `/linear:create-issue <title> | <description> | <priority>`

3. **Priority keywords**: Use "urgent", "high", "medium", "low" for priority

4. **Reference in CLAUDE.md**: Add to your project's `.claude/CLAUDE.md`:
   ```markdown
   ## Linear Integration

   When user wants to create Linear issues, use /linear:create-issue
   For Linear setup/configuration, use /linear:setup
   ```

5. **Auto-assignment**: If you frequently assign to others, disable auto-assign in setup

6. **Projects are optional**: You can select "None" for project if you don't use them

---

## Technical Details

### Dependencies
- Requires `.claude/skills/linear` skill to be installed
- Uses Linear TypeScript SDK via skill scripts
- Stores config in `.claude/linear-config.json`

### What gets executed
Setup command:
- `scripts/setup/setup-credentials.ts` (if needed)
- `scripts/users/me.ts`
- `scripts/list-teams.ts`

Create-issue command:
- `scripts/issues/create.ts`
- `scripts/issues/update.ts` (for priority and assignee)

### Error handling
- All commands validate configuration before proceeding
- Failed API calls show clear error messages
- User can cancel at any question prompt
- Partial configuration is handled gracefully

---

## Future Enhancements

Potential additions for these commands:

- [ ] Support for labels (ask which labels to add)
- [ ] Support for status (set initial status)
- [ ] Support for estimates (add time estimates)
- [ ] Template-based issue creation
- [ ] Bulk issue creation from list
- [ ] Issue creation from file content
- [ ] Integration with git branches

---

**Created**: 2025-01-13
**Requires**: Linear skill v1.0+
**Compatible**: Claude Code v1.0+
