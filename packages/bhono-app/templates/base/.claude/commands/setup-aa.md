---
description: Implement the AA Setup for IA with all the Agents, Skills, Commands, and other configurations(statusline, settings.json, hooks)
tags: [project, setup, configuration, statusline, hooks]
---

# Setup AA for IA

Run interactive setup to configure your Claude Code project with optimal settings.

## Pre-Setup Analysis

Before running setup, analyze current configuration:

**Steps:**

1. Check if `.claude/settings.json` exists
2. Check if `.claude/hooks/hooks.json` is properly configured
3. Check if statusline is configured
4. Check current VERSION
5. Present summary to user with recommendations

**Present findings like:**

```
🔍 Current Configuration Status:

✅ settings.json: Exists (needs review)
⚠️  hooks.json: Missing SessionStart hooks
❌ statusline: Not configured
✅ VERSION: 1.0.1

Recommendations:
- Add SessionStart automation hooks
- Configure statusline for better visibility
- Review settings.json permissions
```

## Ask User for Setup Preferences

After analysis, ask user what they want to configure:

**Question:** "What would you like to setup?"

**Options:**

1. **Full Setup** - Configure everything (settings.json, hooks, statusline)
2. **Hooks Only** - Just add/update SessionStart automation hooks
3. **Statusline Only** - Just configure statusline
4. **Review Only** - Show current config without changes
5. **Custom** - Let me choose specific items

## Execution Based on User Choice

### Option 1: Full Setup

1. **Backup existing files:**

   - Create `settings.json.backup.[timestamp]`
   - Show backup path to user

2. **Run setup script:**

   ```bash
   ./.claude/scripts/setup-project.sh
   ```

3. **Verify results:**

   - Check if settings.json was created/updated
   - Check if hooks are configured
   - Check if statusline is working

4. **Show summary:**

   ```
   ✅ Setup Complete!

   Configured:
   - ✅ settings.json (with optimal permissions)
   - ✅ SessionStart hooks (install_pkgs, validate-skill-rules, check-updates)
   - ✅ UserPromptSubmit hook (skill activation)
   - ✅ Statusline (git branch + model info)

   Next steps:
   1. Review .claude/settings.json
   2. Restart Claude Code to activate changes
   3. Test with: "list available skills"
   ```

### Option 2: Hooks Only

1. **Read current hooks.json:**

   ```bash
   cat .claude/hooks/hooks.json
   ```

2. **Check what's missing:**

   - UserPromptSubmit hook?
   - SessionStart hooks?
   - Which specific hooks are missing?

3. **Update hooks.json** to include:

   ```json
   {
   	"hooks": {
   		"UserPromptSubmit": [
   			{
   				"hooks": [
   					{
   						"type": "command",
   						"command": "$CLAUDE_PROJECT_DIR/.claude/hooks/skill-activation-prompt.sh"
   					}
   				]
   			}
   		],
   		"SessionStart": [
   			{
   				"matcher": "startup",
   				"hooks": [
   					{
   						"type": "command",
   						"command": "$CLAUDE_PROJECT_DIR/.claude/scripts/install_pkgs.sh"
   					},
   					{
   						"type": "command",
   						"command": "$CLAUDE_PROJECT_DIR/.claude/scripts/validate-skill-rules.sh"
   					},
   					{
   						"type": "command",
   						"command": "$CLAUDE_PROJECT_DIR/.claude/scripts/check-updates.sh"
   					}
   				]
   			}
   		]
   	}
   }
   ```

4. **Validate JSON syntax:**
   ```bash
   cat .claude/hooks/hooks.json | jq . > /dev/null && echo "✅ Valid JSON"
   ```

### Option 3: Statusline Only

1. **Check if statusline exists in settings.json:**

   ```bash
   jq 'has("statusLine")' .claude/settings.json
   ```

2. **If missing, add statusline configuration:**

   - Backup settings.json first
   - Add this statusLine config:

   ```json
   "statusLine": {
     "type": "command",
     "command": "bash -c 'input=$(cat); MODEL=$(echo \"$input\" | jq -r \".model.display_name\"); DIR=$(echo \"$input\" | jq -r \".workspace.current_dir\"); BRANCH=\"\"; if git rev-parse --git-dir >/dev/null 2>&1; then BRANCH=\" | 🌿 $(git branch --show-current 2>/dev/null)\"; CHANGES=$(git status --porcelain 2>/dev/null | wc -l); if [ $CHANGES -gt 0 ]; then BRANCH=\"$BRANCH ($CHANGES)\"; fi; fi; echo \"[$MODEL] 📁 ${DIR##*/}$BRANCH\"'\"
   }
   ```

3. **Show preview:**

   ```
   Statusline will show:
   [Sonnet 4.5] 📁 ia-setup | 🌿 main (2)

   Where:
   - [Sonnet 4.5] = Current model
   - 📁 ia-setup = Current directory
   - 🌿 main = Git branch
   - (2) = Number of uncommitted changes
   ```

### Option 4: Review Only

1. **Show current settings.json** (key sections):

   - env variables
   - enabled MCP servers
   - permissions
   - hooks configuration
   - statusline

2. **Show current hooks.json:**

   - List all configured hooks
   - Explain what each does

3. **Show current VERSION:**

   - Current: X.X.X
   - Check if update available

4. **Provide recommendations** without making changes

### Option 5: Custom

Ask user specifically what they want:

- "Add SessionStart hooks?"
- "Configure statusline?"
- "Update permissions in settings.json?"
- "Add specific MCP servers to enabledMcpjsonServers?"

Then execute only selected items.

## Safety Rules

**ALWAYS:**

- ✅ Create backups before modifying existing files
- ✅ Show backup path to user
- ✅ Validate JSON syntax after changes
- ✅ Show clear summary of what was changed
- ✅ Provide rollback instructions if something goes wrong

**NEVER:**

- ❌ Overwrite settings.json without backup
- ❌ Remove existing configuration
- ❌ Make changes without user confirmation
- ❌ Proceed if JSON validation fails

## Rollback Instructions

If setup causes issues:

```bash
# Restore from backup
cp .claude/settings.json.backup.[timestamp] .claude/settings.json

# Or reset hooks
git checkout .claude/hooks/hooks.json

# Restart Claude Code
```

## Post-Setup Verification

After setup, verify everything works:

1. **Test hooks:**

   - Restart Claude Code session
   - Check if SessionStart hooks executed
   - Try skill activation: "use brainstorming skill"

2. **Test statusline:**

   - Check bottom of terminal
   - Should show: `[Model] 📁 dir | 🌿 branch (changes)`

3. **Test MCP servers:**

   ```bash
   # Check enabled servers
   jq '.enabledMcpjsonServers' .claude/settings.json
   ```

4. **Report results to user**

## Example Output

Good output format:

```
🎯 Claude Code Project Setup Complete!

Changes Made:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ settings.json
   - Created with optimal configuration
   - Enabled: context7, sequential-thinking MCPs
   - Added comprehensive permissions

✅ Hooks Configuration
   - UserPromptSubmit: skill-activation-prompt.sh
   - SessionStart:
     • install_pkgs.sh (auto-install dependencies)
     • validate-skill-rules.sh (validate skills)
     • check-updates.sh (check for updates)

✅ Statusline
   - Shows: [Model] 📁 dir | 🌿 branch (changes)

📦 Backup Created
   - Location: .claude/settings.json.backup.1699123456

🔄 Next Steps
   1. Restart Claude Code to activate changes
   2. Test skill activation: "use brainstorming"
   3. Check statusline appears at bottom

💡 Rollback if needed:
   cp .claude/settings.json.backup.1699123456 .claude/settings.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Notes

- This command wraps the `setup-project.sh` script with better UX
- Always interactive - never assumes user wants everything
- Clear communication about what's being changed
- Easy rollback if something goes wrong
- Validates all changes before considering setup complete
