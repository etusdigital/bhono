---
description: Check if all skills are mapped in skill-rules.json and report any missing or orphaned entries
---

# Check Skill Rules Mapping

Audit the skill-rules.json file against actual skill directories to find:
1. **Unmapped skills** - Skills that exist but aren't in skill-rules.json
2. **Orphaned entries** - Entries in skill-rules.json that have no matching skill

## Instructions

1. **Find all project skills** in `.claude/skills/`:
   - List all directories (skills are directories, not files)
   - Exclude `skill-rules.json` (it's the config file, not a skill)

2. **Find all user skills** in `~/.claude/skills/`:
   - List all directories there too

3. **Read skill-rules.json** and extract the skill names from the `skills` object keys

4. **Compare and report**:

### Output Format

```
## Skill Rules Audit

### Project Skills (.claude/skills/)
| Skill | Mapped |
|-------|--------|
| skill-name | ✅ / ❌ |

### User Skills (~/.claude/skills/)
| Skill | Mapped |
|-------|--------|
| skill-name | ✅ / ❌ |

### Orphaned Entries (in rules but no skill file)
| Entry | Status |
|-------|--------|
| entry-name | ❌ No skill directory found |

### Summary
- Project skills: X mapped, Y unmapped
- User skills: X mapped, Y unmapped
- Orphaned entries: Z

### Recommended Actions
[If there are unmapped skills or orphaned entries, suggest specific actions]
```

5. If there are discrepancies, ask if I want you to update skill-rules.json automatically.
