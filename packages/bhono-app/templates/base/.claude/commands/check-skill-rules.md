---
description: Check if all skills are mapped in skill-rules.json and report any missing or orphaned entries
---

# Check Skill Rules Mapping

Audit the skill-rules.json file against actual skill directories and validate the hook system.

## Instructions

### 1. Validate Hook System

First, check that all hooks are properly configured:

```bash
# Check hooks exist and are executable
ls -la .claude/hooks/*.sh

# Test skill-activation-prompt hook
echo '{"session_id":"test","prompt":"analyze architecture"}' | .claude/hooks/skill-activation-prompt.sh

# Test skill-tool-guard hook
echo '{"session_id":"test","tool_name":"Bash","tool_input":{"command":"git push"}}' | .claude/hooks/skill-tool-guard.sh
```

### 2. Find All Skills

**Project skills** in `.claude/skills/`:
- List all `.md` files (skills are markdown files)
- Exclude `skill-rules.json` (config file)

**User skills** in `~/.claude/skills/`:
- List all `.md` files

**Plugin skills** (from enabled plugins):
- Check `superpowers:*` skills
- Check other plugin namespaced skills

### 3. Read skill-rules.json

Extract from the `skills` object:
- Skill names (keys)
- For each skill:
  - `promptTriggers` (keywords + intentPatterns)
  - `toolGuards` (tool + patterns)
  - `enforcement` level
  - `priority` level

### 4. Compare and Report

## Output Format

```markdown
## Skill Rules Audit (v1.2)

### Hook System Status
| Hook | File Exists | Executable | Test |
|------|-------------|------------|------|
| skill-activation-prompt | ✅/❌ | ✅/❌ | ✅/❌ |
| skill-tool-guard | ✅/❌ | ✅/❌ | ✅/❌ |

### Local Skills (.claude/skills/)
| Skill | In Rules | promptTriggers | toolGuards |
|-------|----------|----------------|------------|
| skill-name | ✅/❌ | X keywords, Y patterns | Z guards |

### Plugin Skills (superpowers, etc)
| Skill | In Rules | promptTriggers | toolGuards |
|-------|----------|----------------|------------|
| superpowers:skill-name | ✅/❌ | X keywords, Y patterns | Z guards |

### Orphaned Entries (in rules but no matching skill)
| Entry | Type | Issue |
|-------|------|-------|
| entry-name | local/plugin | No skill file/plugin found |

### Tool Guard Coverage
| Tool | Skills with Guards |
|------|-------------------|
| Bash | skill1, skill2 |
| Edit | skill3 |
| Write | skill4 |

### Summary
- Local skills: X mapped, Y unmapped
- Plugin skills: X mapped, Y unmapped
- Orphaned entries: Z
- Skills with promptTriggers: N
- Skills with toolGuards: M
- Hooks status: OK/ISSUES

### Recommended Actions
[If there are issues, suggest specific fixes]
```

### 5. Validation Checks

Verify for each skill in rules:
- [ ] Has at least `promptTriggers` OR `toolGuards`
- [ ] `enforcement` is valid (suggest/warn/block)
- [ ] `priority` is valid (critical/high/medium/low)
- [ ] `toolGuards` patterns are valid regex
- [ ] `intentPatterns` are valid regex

### 6. Auto-fix Option

If there are discrepancies, ask if I want you to:
1. Add missing skills to skill-rules.json with default config
2. Remove orphaned entries
3. Fix invalid patterns

## Current skill-rules.json Structure (v1.2)

```json
{
  "version": "1.2",
  "skills": {
    "skill-name": {
      "type": "domain|guardrail",
      "enforcement": "suggest|warn|block",
      "priority": "critical|high|medium|low",
      "description": "What this skill does",
      "promptTriggers": {
        "keywords": ["exact match words"],
        "intentPatterns": ["regex patterns"]
      },
      "toolGuards": [
        {
          "tool": "Bash|Edit|Write|Read|Glob|Task|*",
          "patterns": ["regex to match tool input"]
        }
      ]
    }
  }
}
```
