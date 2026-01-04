#!/usr/bin/env node
/**
 * Skill Tool Guard Hook (PreToolUse)
 *
 * Recommends using a skill before executing certain tools.
 * Reads toolGuards from skill-rules.json to determine which
 * skills should be used before specific tool patterns.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PreToolUseInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

interface ToolGuard {
  tool: string;
  patterns: string[];
}

interface SkillRule {
  type: string;
  enforcement: string;
  priority: string;
  description: string;
  toolGuards?: ToolGuard[];
}

interface SkillRules {
  version: string;
  skills: Record<string, SkillRule>;
}

function main() {
  try {
    const input = readFileSync(0, 'utf-8');
    const data: PreToolUseInput = JSON.parse(input);

    // Load skill rules
    const rulesPath = join(__dirname, '..', 'skills', 'skill-rules.json');
    let rules: SkillRules;

    try {
      rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    } catch {
      process.exit(0);
    }

    const matchedSkills: string[] = [];

    // Check each skill's toolGuards
    for (const [skillName, config] of Object.entries(rules.skills)) {
      const guards = config.toolGuards;
      if (!guards || guards.length === 0) {
        continue;
      }

      for (const guard of guards) {
        // Check if tool matches
        if (guard.tool !== data.tool_name && guard.tool !== '*') {
          continue;
        }

        // Get the content to check based on tool type
        let contentToCheck = '';
        if (data.tool_name === 'Bash') {
          contentToCheck = String(data.tool_input.command || '');
        } else if (data.tool_name === 'Edit' || data.tool_name === 'Write') {
          contentToCheck = String(data.tool_input.file_path || '');
        } else {
          contentToCheck = JSON.stringify(data.tool_input);
        }

        // Check if any pattern matches
        const matched = guard.patterns.some(pattern => {
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(contentToCheck);
          } catch {
            return contentToCheck.toLowerCase().includes(pattern.toLowerCase());
          }
        });

        if (matched) {
          matchedSkills.push(skillName);
          break;
        }
      }
    }

    // No matches = no output
    if (matchedSkills.length === 0) {
      process.exit(0);
    }

    const skillList = matchedSkills.join(', ');
    const suggestion = `⚡ Tool guard: consider using skill "${skillList}" before this ${data.tool_name} command`;

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: suggestion
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
